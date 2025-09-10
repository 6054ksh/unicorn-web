// src/app/api/kakao/event/test/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { callKakaoChannelAPI } from '@/lib/server/kakaoChannel';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // 사용자의 kakaoAppUserId 확보(카카오 연동 선행 필요)
    const userSnap = await db.collection('users').doc(uid).get();
    const appUserIdRaw = userSnap.data()?.kakaoAppUserId as unknown;
    const appUserId = typeof appUserIdRaw === 'string' ? appUserIdRaw.trim() : '';
    if (!appUserId) {
      return NextResponse.json({ error: 'not-linked' }, { status: 400 });
    }

    // 베이스 URL
    const base =
      (process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''))
        .replace(/\/+$/, '');

    // ★ 함수 시그니처에서 두 번째 인자의 "배열 타입"을 그대로 추론해서 사용
    type TargetsType = Parameters<typeof callKakaoChannelAPI>[1];
    const targets: TargetsType = [
      { id: appUserId, idType: 'appUserId' } as TargetsType[number],
    ];

    const payload = {
      title: '테스트 모임',
      location: '테스트장소',
      startAtKST: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      url: `${base}/room`,
      roomId: 'TEST',
    };

    const r = await callKakaoChannelAPI('room_created', targets, payload);
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
