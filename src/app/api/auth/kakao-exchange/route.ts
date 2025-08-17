import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const clientId = process.env.KAKAO_REST_API_KEY!;
    const redirectUri = process.env.KAKAO_REDIRECT_URI!; // http://localhost:3000/login/callback
    const clientSecret = process.env.KAKAO_CLIENT_SECRET; // 사용중이면 넣기(선택)

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
      return NextResponse.json({ error: json.error_description || 'token error', raw: json }, { status: 400 });
    }

    // access_token, refresh_token, token_type, expires_in, scope ...
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
