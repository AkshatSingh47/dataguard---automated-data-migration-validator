import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

export interface StoredUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredLoginEvent {
  _id: string;
  userId?: string;
  email: string;
  action: 'register' | 'login' | 'logout' | 'failed_login';
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuthFile {
  users: StoredUser[];
  events: StoredLoginEvent[];
}

const filePath = path.join(process.cwd(), 'tmp', 'dataguard-auth.json');

function emptyStore(): AuthFile {
  return { users: [], events: [] };
}

function readStore(): AuthFile {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as AuthFile;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: AuthFile) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}

function newId(): string {
  return randomBytes(12).toString('hex');
}

export function findUserByEmail(email: string): StoredUser | null {
  return readStore().users.find((user) => user.email === email) || null;
}

export function findUserById(id: string): StoredUser | null {
  return readStore().users.find((user) => user._id === id) || null;
}

export function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  lastLoginAt?: Date;
}): StoredUser {
  const store = readStore();
  if (store.users.some((user) => user.email === input.email)) {
    throw new Error('An account with this email already exists.');
  }
  const now = new Date().toISOString();
  const user: StoredUser = {
    _id: newId(),
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    lastLoginAt: input.lastLoginAt?.toISOString(),
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(user);
  writeStore(store);
  return user;
}

export function updateUser(user: StoredUser): StoredUser {
  const store = readStore();
  const index = store.users.findIndex((item) => item._id === user._id);
  if (index === -1) throw new Error('Account was not found.');
  const next = { ...user, updatedAt: new Date().toISOString() };
  store.users[index] = next;
  writeStore(store);
  return next;
}

export function addLoginEvent(event: Omit<StoredLoginEvent, '_id' | 'createdAt'>) {
  const store = readStore();
  store.events.push({
    _id: newId(),
    createdAt: new Date().toISOString(),
    ...event,
  });
  writeStore(store);
}
