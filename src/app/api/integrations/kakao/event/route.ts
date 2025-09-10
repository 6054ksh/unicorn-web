// src/app/api/integrations/kakao/event/route.ts
import { NextResponse } from 'next/server';
import { callKakaoChannelAPI, KakaoEventUser } from '@/lib/server/kakaoChannel';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    // (옵션) 관리자 보호
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await getAdminAuth().verifyIdToken(idToken);

    // 권한검증을 넣고 싶다면 여기서 admins 컬렉션 확인

    const body = await req.json().catch(() => ({}));
    const eventName = String(body?.eventName || '').trim();
    const users = Array.isArray(body?.users) ? (body.users as KakaoEventUser[]) : [];
    const params = (body?.params && typeof body.params === 'object') ? body.params : undefined;

    if (!eventName || users.length === 0) {
      return NextResponse.json({ error: 'eventName and users are required' }, { status: 400 });
    }

    const r = await callKakaoChannelAPI(eventName, users, params);
    return NextResponse.json({ ok: true, result: r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
