// src/app/api/rooms/create/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function bad(message: string, status=400) { return NextResponse.json({ error: message }, { status }); }

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return bad('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json();
    const missing: string[] = [];
    if (!body?.title?.trim()) missing.push('title');
    if (!body?.location?.trim()) missing.push('location');
    if (!body?.startAt) missing.push('startAt');
    if (!body?.capacity && body?.capacity !== 0) missing.push('capacity');
    if (missing.length) return NextResponse.json({ error:'missing-fields', missing }, { status:400 });

    const title = String(body.title).trim();
    const type = body.type ? String(body.type).trim() : undefined;
    const content = body.content ? String(body.content).trim() : undefined;
    const location = String(body.location).trim();
    const startAt = new Date(body.startAt);
    if (isNaN(startAt as any)) return bad('invalid startAt');

    // 종료시간 자동: 시작 + 5시간
    const endAt = new Date(startAt.getTime() + 5 * 60 * 60 * 1000);

    // 공개시점(익명 해제) 예: 시작 1시간 전
    const revealAt = new Date(startAt.getTime() - 60 * 60 * 1000);

    const capacity = Number(body.capacity || 0);
    const kakaoOpenChatUrl = body.kakaoOpenChatUrl || undefined;

    const nowIso = new Date().toISOString();

    const ref = await db.collection('rooms').add({
      title,
      titleLower: title.toLowerCase(),
      type, content,
      location,
      capacity,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      revealAt: revealAt.toISOString(),
      kakaoOpenChatUrl: kakaoOpenChatUrl || null,
      participants: [],
      participantsCount: 0,
      closed: false,
      creatorUid: uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // (선택) 점수 반영: 개설 +30, 정원≥8 +40
    // const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
    // await db.collection('scores').doc(uid).set({
    //   total: FieldValue.increment(30 + (capacity >= 8 ? 40 : 0)),
    //   createdRooms: FieldValue.increment(1),
    //   lastUpdatedAt: nowIso,
    // }, { merge: true });

    return NextResponse.json({ ok:true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
