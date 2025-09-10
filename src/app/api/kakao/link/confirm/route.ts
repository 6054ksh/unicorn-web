// src/app/api/kakao/link/confirm/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 로그인 체크
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const { code } = await req.json().catch(() => ({}));
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

    const tokenRef = db.collection('kakao_link_tokens').doc(code);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) return NextResponse.json({ error: 'invalid-code' }, { status: 400 });

    const { appUserId, expiresAt } = tokenSnap.data() as { appUserId?: string; expiresAt?: number };
    if (!appUserId) return NextResponse.json({ error: 'invalid-token' }, { status: 400 });
    if (typeof expiresAt === 'number' && Date.now() > expiresAt) {
      await tokenRef.delete().catch(() => {});
      return NextResponse.json({ error: 'expired' }, { status: 400 });
    }

    // users/{uid} 에 appUserId 저장 + 역인덱스도 작성
    const nowIso = new Date().toISOString();
    await db.runTransaction(async (tx) => {
      const uref = db.collection('users').doc(uid);
      tx.set(uref, { kakaoAppUserId: appUserId, kakaoLinkedAt: nowIso }, { merge: true });
      const rev = db.collection('kakaoAppUsers').doc(String(appUserId));
      tx.set(rev, { uid, linkedAt: nowIso }, { merge: true });
      tx.delete(tokenRef);
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
