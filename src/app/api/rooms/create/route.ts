export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { COL, RoomDoc } from '@/types/firestore';
import * as admin from 'firebase-admin';
import { TOPIC_ALL_ROOMS } from '@/lib/topic';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status; return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(() => ({}));
    const missing: string[] = [];
    const title = (body?.title || '').trim();             if (!title) missing.push('title');
    const location = (body?.location || '').trim();       if (!location) missing.push('location');
    const capacity = Number(body?.capacity || 0);         if (!capacity || capacity < 1) missing.push('capacity');
    const startAtRaw = (body?.startAt || '').trim();      if (!startAtRaw) missing.push('startAt');

    if (missing.length) {
      return NextResponse.json({ error: 'missing fields', missing }, { status: 400 });
    }

    const startAt = new Date(startAtRaw);
    if (Number.isNaN(startAt.getTime())) throw httpError('invalid startAt', 400);

    // ✅ 자동 시간 계산
    const endAt = new Date(startAt.getTime() + 5 * 60 * 60 * 1000);    // +5h
    const revealAt = new Date(startAt.getTime() - 60 * 60 * 1000);     // -1h

    const nowIso = new Date().toISOString();
    const data: RoomDoc = {
      title,
      titleLower: title.toLowerCase(),
      type: (body?.type || '').trim() || undefined,
      content: (body?.content || '').trim() || undefined,
      location,
      capacity,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      revealAt: revealAt.toISOString(),
      kakaoOpenChatUrl: body?.kakaoOpenChatUrl?.trim() || null,
      creatorUid: uid,
      participants: [],
      participantsCount: 0,
      closed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const ref = await db.collection(COL.rooms).add(data);

    // ✅ 점수(+30, 정원≥8이면 +40 추가)
    const scoreRef = db.collection(COL.scores).doc(uid);
    const plus = 30 + (capacity >= 8 ? 40 : 0);
    await scoreRef.set({
      total: admin.firestore.FieldValue.increment(plus),
      createdRooms: admin.firestore.FieldValue.increment(1),
      lastUpdatedAt: nowIso,
    }, { merge: true });

    // ✅ “방 생성” 전체 공지(토픽) — 과도한 빈도를 피하기 위해 "생성 시 1회"만 전송
    const link = `/room/${ref.id}`;
    await messaging.send({
      topic: TOPIC_ALL_ROOMS,
      webpush: {
        headers: { Urgency: 'high', TTL: '120' },
        fcmOptions: { link },
        notification: {
          title: '새 모임이 올라왔어요 🎉',
          body: `『${title}』 — ${location} / 정원 ${capacity}명\n눌러서 바로 참여해보세요!`,
          tag: 'room-created',   // 동일 태그 알림은 겹치지 않게
          renotify: true,
        },
      },
      data: { url: link },
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
