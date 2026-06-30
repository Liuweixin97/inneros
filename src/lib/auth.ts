import 'server-only';

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';

export const DEFAULT_OWNER_USER_ID = 'liuweixin';
const SESSION_COOKIE = 'inneros_session';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

function sessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function findUserByEmail(email: string): (AuthUser & { password_hash: string }) | null {
  const normalized = email.trim().toLowerCase();
  const row = getDb()
    .prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?')
    .get(normalized) as (AuthUser & { password_hash: string }) | undefined;
  return row || null;
}

export async function createUser(input: { name: string; email: string; password: string }): Promise<AuthUser> {
  const db = getDb();
  const now = new Date().toISOString();
  const user: AuthUser & { password_hash: string } = {
    id: uuidv4(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password_hash: await hashPassword(input.password),
  };

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
     VALUES (@id, @name, @email, @password_hash, @created_at, @updated_at)`
  ).run({ ...user, created_at: now, updated_at: now });

  return { id: user.id, name: user.name, email: user.email };
}

export async function setSessionCookie(user: AuthUser): Promise<void> {
  const token = await new SignJWT({ name: user.name, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(sessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.name !== 'string') {
      return null;
    }
    return { id: payload.sub, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

