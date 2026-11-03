import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isMongoConnected } from '../db/mongo.js';
import {
  addLoginEvent,
  createUser as createFileUser,
  findUserByEmail as findFileUserByEmail,
  findUserById as findFileUserById,
  StoredUser,
  updateUser as updateFileUser,
} from '../db/fileAuthStore.js';
import { UserModel, UserDocument } from '../models/userModel.js';
import { LoginEventModel } from '../models/loginEventModel.js';

const TOKEN_COOKIE = 'dataguard_token';
const TOKEN_DAYS = 7;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthContextMeta {
  ip?: string;
  userAgent?: string;
}

type StoredAccount = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
};

function jwtSecret(): string {
  return process.env.JWT_SECRET || 'dataguard-dev-jwt-secret-change-me';
}

function fromMongo(user: UserDocument): StoredAccount {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : undefined,
  };
}

function fromFile(user: StoredUser): StoredAccount {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function toPublicUser(user: StoredAccount): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function recordEvent(
  email: string,
  action: 'register' | 'login' | 'logout' | 'failed_login',
  meta: AuthContextMeta,
  userId?: string
) {
  if (isMongoConnected()) {
    LoginEventModel.create({
      userId: userId || undefined,
      email: email.toLowerCase(),
      action,
      ip: meta.ip,
      userAgent: meta.userAgent,
    }).catch((err) => {
      console.warn('Failed to store login event:', err.message);
    });
    return;
  }
  addLoginEvent({
    userId,
    email: email.toLowerCase(),
    action,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

export function signToken(user: PublicUser): string {
  return jwt.sign({ userId: user.id, email: user.email, name: user.name }, jwtSecret(), {
    expiresIn: `${TOKEN_DAYS}d`,
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function verifyToken(token: string): { userId: string; email: string; name: string } {
  return jwt.verify(token, jwtSecret()) as { userId: string; email: string; name: string };
}

export function readTokenFromRequest(req: {
  cookies?: Record<string, string>;
  headers: { authorization?: string };
}): string | null {
  const cookieToken = req.cookies?.[TOKEN_COOKIE];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export { TOKEN_COOKIE };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function findAccountByEmail(email: string): Promise<StoredAccount | null> {
  if (isMongoConnected()) {
    const user = await UserModel.findOne({ email });
    return user ? fromMongo(user as UserDocument) : null;
  }
  const user = findFileUserByEmail(email);
  return user ? fromFile(user) : null;
}

async function createAccount(input: {
  name: string;
  email: string;
  passwordHash: string;
  lastLoginAt: Date;
}): Promise<StoredAccount> {
  if (isMongoConnected()) {
    const user = await UserModel.create(input);
    return fromMongo(user as UserDocument);
  }
  return fromFile(createFileUser(input));
}

async function touchLastLogin(account: StoredAccount): Promise<StoredAccount> {
  const lastLoginAt = new Date();
  if (isMongoConnected()) {
    const user = await UserModel.findByIdAndUpdate(account.id, { lastLoginAt }, { new: true });
    if (!user) throw new Error('Account was not found.');
    return fromMongo(user as UserDocument);
  }
  const user = findFileUserById(account.id);
  if (!user) throw new Error('Account was not found.');
  user.lastLoginAt = lastLoginAt.toISOString();
  return fromFile(updateFileUser(user));
}

export async function registerUser(
  input: { name: string; email: string; password: string },
  meta: AuthContextMeta
): Promise<PublicUser> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password || '';

  if (name.length < 2) throw new Error('Please enter your full name.');
  if (!validateEmail(email)) throw new Error('Please enter a valid email address.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');

  const existing = await findAccountByEmail(email);
  if (existing) throw new Error('An account with this email already exists.');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createAccount({
    name,
    email,
    passwordHash,
    lastLoginAt: new Date(),
  });

  recordEvent(email, 'register', meta, user.id);
  return toPublicUser(user);
}

export async function loginUser(
  input: { email: string; password: string },
  meta: AuthContextMeta
): Promise<PublicUser> {
  const email = normalizeEmail(input.email);
  const password = input.password || '';

  if (!validateEmail(email) || !password) {
    throw new Error('Email and password are required.');
  }

  const user = await findAccountByEmail(email);
  if (!user) {
    recordEvent(email, 'failed_login', meta);
    throw new Error('Invalid email or password.');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    recordEvent(email, 'failed_login', meta, user.id);
    throw new Error('Invalid email or password.');
  }

  const updated = await touchLastLogin(user);
  recordEvent(email, 'login', meta, updated.id);
  return toPublicUser(updated);
}

export async function logoutUser(email: string | undefined, meta: AuthContextMeta) {
  if (email) recordEvent(email, 'logout', meta);
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  if (isMongoConnected()) {
    const user = await UserModel.findById(id);
    return user ? toPublicUser(fromMongo(user as UserDocument)) : null;
  }
  const user = findFileUserById(id);
  return user ? toPublicUser(fromFile(user)) : null;
}
