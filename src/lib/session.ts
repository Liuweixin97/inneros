import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'inneros_session';

export interface SessionIdentity {
  id: string;
  name: string;
  username: string;
}

const DEVELOPMENT_SECRET = 'inneros-local-development-secret-only';

function sessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || (process.env.NODE_ENV === 'development' ? DEVELOPMENT_SECRET : '');
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionIdentity): Promise<string> {
  return new SignJWT({ name: user.name, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.sub || typeof payload.name !== 'string' || typeof payload.username !== 'string') {
      return null;
    }
    return { id: payload.sub, name: payload.name, username: payload.username };
  } catch {
    return null;
  }
}
