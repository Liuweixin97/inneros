import { NextResponse } from 'next/server';
import { GUEST_USER, setSessionCookie } from '@/lib/auth';

export async function POST() {
  await setSessionCookie(GUEST_USER);
  return NextResponse.json({ user: GUEST_USER });
}
