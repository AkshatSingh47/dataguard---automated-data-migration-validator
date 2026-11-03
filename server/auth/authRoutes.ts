import express from 'express';
import cookieParser from 'cookie-parser';
import {
  TOKEN_COOKIE,
  cookieOptions,
  findUserById,
  loginUser,
  logoutUser,
  readTokenFromRequest,
  registerUser,
  signToken,
  verifyToken,
} from './authService.js';

function clientMeta(req: express.Request) {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers['user-agent'],
  };
}

export function registerAuthRoutes(app: express.Express) {
  app.use(cookieParser());

  app.post('/api/auth/register', async (req, res) => {
    try {
      const user = await registerUser(req.body || {}, clientMeta(req));
      const token = signToken(user);
      res.cookie(TOKEN_COOKIE, token, cookieOptions());
      return res.status(201).json({ success: true, user });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const user = await loginUser(req.body || {}, clientMeta(req));
      const token = signToken(user);
      res.cookie(TOKEN_COOKIE, token, cookieOptions());
      return res.json({ success: true, user });
    } catch (err: any) {
      return res.status(401).json({ success: false, message: err.message || 'Login failed.' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const token = readTokenFromRequest(req);
      let email: string | undefined;
      if (token) {
        try {
          email = verifyToken(token).email;
        } catch {
          email = undefined;
        }
      }
      await logoutUser(email, clientMeta(req));
    } catch {
      // always clear the cookie
    }
    res.clearCookie(TOKEN_COOKIE, { path: '/' });
    return res.json({ success: true });
  });

  app.get('/api/auth/me', async (req, res) => {
    const token = readTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    try {
      const payload = verifyToken(token);
      const user = await findUserById(payload.userId);
      if (!user) {
        res.clearCookie(TOKEN_COOKIE, { path: '/' });
        return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
      }
      return res.json({ success: true, user });
    } catch {
      res.clearCookie(TOKEN_COOKIE, { path: '/' });
      return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
    }
  });
}
