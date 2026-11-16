import { Router } from 'express';
import type { Response } from 'express';
import { isDatabaseConfigured } from '../db/index.ts';
import {
  optionalAuth,
  SESSION_COOKIE_NAME,
  signSessionToken,
  upsertGoogleUserInDb,
  verifyGoogleIdToken,
} from '../middleware/auth.ts';

export const authRouter = Router();
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    path: '/',
  };
}

async function handleGoogleSignIn(idToken: unknown, res: Response) {
  if (!idToken || typeof idToken !== 'string') {
    return { status: 400, body: { error: 'Token de Google requerido.' } };
  }

  if (!isDatabaseConfigured()) {
    return {
      status: 503,
      body: {
        offlineFallback: true,
        error:
          'PostgreSQL no está configurado en el servidor API (DATABASE_URL). Las cuentas se activarán al conectar Supabase o Neon.',
      },
    };
  }

  const hasClientId = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() ||
      process.env.VITE_GOOGLE_CLIENT_ID?.trim()
  );
  if (!hasClientId) {
    return {
      status: 501,
      body: {
        error:
          'GOOGLE_CLIENT_ID no configurado en el backend API.',
      },
    };
  }

  const profile = await verifyGoogleIdToken(idToken);
  if (!profile) {
    return {
      status: 401,
      body: { error: 'No se pudo validar el token de Google.' },
    };
  }

  const user = await upsertGoogleUserInDb(profile);
  const token = signSessionToken(user, SESSION_TTL_SECONDS);
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_TTL_SECONDS * 1000,
  });

  return {
    status: 200,
    body: {
      user,
    },
  };
}

authRouter.post('/session', async (req, res) => {
  try {
    const result = await handleGoogleSignIn(req.body?.idToken, res);
    res.status(result.status).json(result.body);
  } catch (err: unknown) {
    console.error('[Auth] /api/auth/session error:', err);
    res.status(401).json({
      error:
        err instanceof Error
          ? err.message
          : 'Error verificando sesión con Google.',
    });
  }
});

authRouter.post('/google', async (req, res) => {
  try {
    const result = await handleGoogleSignIn(req.body?.idToken, res);
    res.status(result.status).json(result.body);
  } catch (err: unknown) {
    console.error('[Auth] /api/auth/google error:', err);
    res.status(401).json({
      error:
        err instanceof Error
          ? err.message
          : 'Error verificando sesión con Google.',
    });
  }
});

authRouter.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user ?? null });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  res.json({ ok: true });
});
