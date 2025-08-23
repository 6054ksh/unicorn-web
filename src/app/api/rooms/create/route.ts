// src/app/api/rooms/create/route.ts
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

    const body = await req.json().catch(() => ({}));
    const missing: string[] = [];
    const title = (body?.title || '').trim() || missing.push('title');
    const location = (body?.location || '').trim() || missing.push('location');
    const capacity = Number(body?.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) missing.push('capacity');
    const startAtIso = (body?.startAt || '').trim() || missing.push('startAt');
    if (missing.length) return NextResponse.json({ error: 'missing fields', missing }, { status: 400 });

    const startAt = new Date(startAtIso);
    if (Number.isNaN(startAt.getTime())) return NextResponse.json({ error: 'invalid startAt' }, { status: 400 });

    const endAt = new Date(startAt.getTime() + 5 * 60 * 60 * 1000);
    const revealAt = new Date(startAt.getTime() - 60 * 60 * 1000);

    const ref = await db.collection('rooms').add({
      title,
      titleLower: title.toLowerCase(),
      location,
      capacity,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      revealAt: revealAt.toISOString(),
      kakaoOpenChatUrl: (body?.kakaoOpenChatUrl || '').trim() || null,
      creatorUid: uid,
      participants: [],
      participantsCount: 0,
      closed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // (선택) 점수 처리: 개설 +30 / 정원≥8 +40
    const base = 30 + (capacity >= 8 ? 40 : 0);
    await db.collection('scores').doc(uid).set(
      {
        total: FieldValue.increment(base),
        createdRooms: FieldValue.increment(1),
        lastUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
