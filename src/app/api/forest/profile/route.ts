import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getForestProfile, updateForestProfile, type ForestProfileUpdates } from '@/lib/forest/profile';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  return NextResponse.json(getForestProfile(user.id, { persistent: true }));
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const body = await request.json() as ForestProfileUpdates;
    return NextResponse.json(updateForestProfile(user.id, body));
  } catch (error) {
    console.error('[forest/profile PATCH]', error);
    return NextResponse.json({ error: '保存林间路线失败' }, { status: 500 });
  }
}
