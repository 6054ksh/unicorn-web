// src/app/api/me/register-fcm-token/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { uid } = await auth.verifyIdToken(idToken);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
    }

    const token = (body?.token || '').trim();
    if (!token) return NextResponse.json({ error: 'token-required' }, { status: 400 });

    const userRef = db.collection('users').doc(uid);

    // 1) users/{uid}.fcmTokens 배열에 추가(중복 제거)
    await userRef.set(
      {
        uid,
        fcmTokens: FieldValue.arrayUnion(token),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 2) (선택) 서브컬렉션에도 기록해두면 기기별 관리가 쉬움
    await userRef.collection('fcmTokens').doc(token).set(
      {
        token,
        registeredAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
