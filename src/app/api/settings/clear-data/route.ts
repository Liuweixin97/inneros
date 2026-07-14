import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { clearUserData } from '@/lib/db/user-data';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    clearUserData(user.id);

    return NextResponse.json({
      success: true,
      message: '当前账户数据已清除',
    });
  } catch (error) {
    console.error('POST /api/settings/clear-data error:', error);
    return NextResponse.json(
      { error: '清除数据失败' },
      { status: 500 }
    );
  }
}
