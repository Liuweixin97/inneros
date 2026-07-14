import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { clearUserData } from '@/lib/db/user-data';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    clearUserData(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/clear-data error:', error);
    return NextResponse.json(
      { error: '清除数据失败' },
      { status: 500 }
    );
  }
}
