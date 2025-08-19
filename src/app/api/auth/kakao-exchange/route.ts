export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    // 콜백에서 받은 redirect_uri 우선, 없으면 env 폴백
    const redirectUri =
      searchParams.get('redirect_uri') ||
      process.env.KAKAO_REDIRECT_URI ||
      'https://unicorn-web-git-main-6054kshs-projects.vercel.app/login/callback';

    const clientId = process.env.KAKAO_REST_API_KEY!;
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });
    if (clientSecret) body.set('client_secret', clientSecret);

    const resp = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    });

    const json = await resp.json();
    if (!resp.ok) {
      return NextResponse.json(
        { error: json.error_description || 'token error', raw: json },
        { status: 400 }
      );
    }

    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
