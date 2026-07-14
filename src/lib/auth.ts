import 'server-only';

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from '@/lib/session';

export const DEFAULT_OWNER_USER_ID = 'liuweixin';
export interface AuthUser {
  id: string;
  name: string;
  username: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function findUserByUsername(username: string): (AuthUser & { password_hash: string }) | null {
  const normalized = username.trim().toLowerCase();
  const row = getDb()
    .prepare('SELECT id, name, username, password_hash FROM users WHERE username = ?')
    .get(normalized) as (AuthUser & { password_hash: string }) | undefined;
  return row || null;
}

export async function createUser(input: { name: string; username: string; password: string }): Promise<AuthUser> {
  const db = getDb();
  const now = new Date().toISOString();
  const user: AuthUser & { password_hash: string } = {
    id: uuidv4(),
    name: input.name.trim(),
    username: input.username.trim().toLowerCase(),
    password_hash: await hashPassword(input.password),
  };

  db.prepare(
    `INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
     VALUES (@id, @name, @username, @email, @password_hash, @created_at, @updated_at)`
  ).run({ ...user, email: `${user.username}@inneros.local`, created_at: now, updated_at: now });

  return { id: user.id, name: user.name, username: user.username };
}

export async function setSessionCookie(user: AuthUser): Promise<void> {
  const token = await createSessionToken(user);

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
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export function updateUserProfile(userId: string, input: { name: string; username: string }): AuthUser | null {
  const db = getDb();
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE users SET name = ?, username = ?, email = ?, updated_at = ? WHERE id = ?'
  ).run(name, username, `${username}@inneros.local`, now, userId);
  if (result.changes === 0) return null;
  return { id: userId, name, username };
}

export async function updateUserPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  getDb().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(passwordHash, new Date().toISOString(), userId);
}
