import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { isOriginAllowed, parseAllowedOrigins } from './cors.ts';

export const SESSION_COOKIE_NAME = 'scz_session';

export interface AuthenticatedUser {
  id: string;
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
    }
  }
}

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return (
    (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()) ||
    (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? crypto.createHash('sha256').update(process.env.APP_URL).digest('hex')
      : EPHEMERAL_FALLBACK_SECRET)
  );
}

function getGoogleClient(): OAuth2Client | null {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return null;
  return new OAuth2Client(clientId);
}

export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || '';
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

export interface SessionTokenPayload {
  uid: string;
  sub: string;
  email: string;
  role: 'user' | 'admin';
  exp: number;
}

export function signSessionToken(user: AuthenticatedUser, ttlSeconds = 60 * 60 * 24 * 7): string {
  const payload: SessionTokenPayload = {
    uid: user.id,
    sub: user.googleSub,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as SessionTokenPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(idToken: string): Promise<{
  sub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
} | null> {
  const client = getGoogleClient();
  const audience =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!client || !audience) {
    return null;
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    return null;
  }

  return {
    sub: payload.sub,
    email: payload.email,
    displayName: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture || null,
  };
}

export async function upsertGoogleUserInDb(profile: {
  sub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}): Promise<AuthenticatedUser> {
  const db = getDb();
  if (!db) {
    throw new Error('Base de datos no configurada');
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.googleSub, profile.sub))
    .limit(1);

  const shouldPromoteAdmin = isAdminEmail(profile.email);

  if (existing.length > 0) {
    const row = existing[0];
    const nextRole: 'user' | 'admin' =
      shouldPromoteAdmin || row.role === 'admin' ? 'admin' : 'user';

    const [updated] = await db
      .update(users)
      .set({
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        role: nextRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, row.id))
      .returning();

    return {
      id: updated.id,
      googleSub: updated.googleSub,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
    };
  }

  const [created] = await db
    .insert(users)
    .values({
      googleSub: profile.sub,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      role: shouldPromoteAdmin ? 'admin' : 'user',
    })
    .returning();

  return {
    id: created.id,
    googleSub: created.googleSub,
    email: created.email,
    displayName: created.displayName,
    avatarUrl: created.avatarUrl,
    role: created.role,
  };
}

async function resolveBearerUser(req: Request): Promise<AuthenticatedUser | null> {
  const header = req.headers.authorization;
  const bearerToken =
    header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const token = bearerToken || getSessionCookie(req);
  if (!token) return null;

  const db = getDb();

  // 1) Try compact backend-issued HMAC session token first (fast path)
  const session = verifySessionToken(token);
  if (session) {
    if (!db) return null;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, session.uid))
      .limit(1);
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      id: u.id,
      googleSub: u.googleSub,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      role: u.role,
    };
  }

  // 2) Try verifying directly as Google ID token (3-segment JWT)
  if (token.split('.').length === 3 && db) {
    try {
      const profile = await verifyGoogleIdToken(token);
      if (profile) {
        return await upsertGoogleUserInDb(profile);
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) {
      continue;
    }
    return part.slice(separator + 1).trim() || null;
  }
  return null;
}

function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    req.user = await resolveBearerUser(req);
  } catch (err) {
    console.warn('[Auth] optionalAuth error:', err);
    req.user = null;
  }
  next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (
      !isSafeMethod(req.method) &&
      getSessionCookie(req)
    ) {
      const origin = req.headers.origin?.trim().replace(/\/+$/, '');
      const allowedOrigins = parseAllowedOrigins(
        process.env.ALLOWED_ORIGINS,
        process.env.APP_URL
      );
      const isLocalDevelopmentOrigin =
        origin !== undefined &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      if (!origin || (!allowedOrigins.includes(origin) && !isLocalDevelopmentOrigin)) {
        res.status(403).json({ error: 'Origen no autorizado para esta sesión.' });
        return;
      }
    }

    const user = req.user ?? (await resolveBearerUser(req));
    if (!user) {
      res.status(401).json({
        error: 'Sesión requerida. Inicia sesión con Google para continuar.',
      });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth] requireAuth error:', err);
    res.status(401).json({ error: 'Token de sesión inválido o expirado.' });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Sesión requerida.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Permiso denegado. Se requiere rol de administrador.',
    });
    return;
  }
  next();
}
