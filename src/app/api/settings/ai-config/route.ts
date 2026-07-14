import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com';
    const model = process.env.AI_MODEL || 'deepseek-v4-flash';
    const apiKey = process.env.AI_API_KEY || '';

    // Mask the API key: show first 3 and last 4 characters
    let apiKeyMasked = '未设置';
    if (apiKey) {
      if (apiKey.length > 10) {
        apiKeyMasked = `${apiKey.slice(0, 6)}${'•'.repeat(12)}${apiKey.slice(-4)}`;
      } else {
        apiKeyMasked = '•'.repeat(apiKey.length);
      }
    }

    return NextResponse.json({
      base_url: baseUrl,
      model,
      api_key_masked: apiKeyMasked,
    });
  } catch (error) {
    console.error('GET /api/settings/ai-config error:', error);
    return NextResponse.json(
      { error: '获取 AI 配置失败' },
      { status: 500 }
    );
  }
}
