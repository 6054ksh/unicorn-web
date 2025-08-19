// src/app/api/auth/kakao-exchange/route.ts
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

    // ✅ 콜백 페이지에서 넘겨주면 우선 사용, 없으면 env fallback
    const redirectUri =
      searchParams.get('redirect_uri') || process.env.KAKAO_REDIRECT_URI!;
    if (!redirectUri) {
      return NextResponse.json({ error: 'redirect_uri missing' }, { status: 400 });
    }

    const clientId = process.env.KAKAO_REST_API_KEY!;
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,  // ✅ 반드시 인가 요청 때와 동일
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
