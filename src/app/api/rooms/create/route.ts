export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { COL, RoomDoc } from '@/types/firestore';
import * as admin from 'firebase-admin';
import { collectAllUserTokens, removeBadTokens } from '@/lib/fcmServer';

function httpError(message: string, status = 400) { const e: any = new Error(message); e.status = status; return e; }

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
    if (missing.length) return NextResponse.json({ error: 'missing fields', missing }, { status: 400 });

    const startAt = new Date(startAtRaw);
    if (Number.isNaN(startAt.getTime())) throw httpError('invalid startAt', 400);

    // 자동 시간: +5h / 공개: -1h
    const endAt = new Date(startAt.getTime() + 5 * 60 * 60 * 1000);
    const revealAt = new Date(startAt.getTime() - 60 * 60 * 1000);
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

    // 점수(+30 / 정원≥8:+40)
    const plus = 30 + (capacity >= 8 ? 40 : 0);
    await db.collection(COL.scores).doc(uid).set({
      total: admin.firestore.FieldValue.increment(plus),
      createdRooms: admin.firestore.FieldValue.increment(1),
      lastUpdatedAt: nowIso,
    }, { merge: true });

    // 🔔 빠른 알림: 모든 유효 토큰 수집 → 멀티캐스트 전송
    const { list, byToken } = await collectAllUserTokens();
    const tokens = list.map(x => x.token);
    const link = `/room/${ref.id}`;

    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await messaging.sendEachForMulticast({
        tokens: chunk,
        webpush: {
          headers: { Urgency: 'high', TTL: '120' },
          fcmOptions: { link },
          notification: {
            title: '새 모임이 올라왔어요 🎉',
            body: `『${title}』 — ${location} / 정원 ${capacity}명\n눌러서 바로 참여해보세요!`,
            tag: 'room-created',   // 동일 태그 알림은 1개만 표시
            renotify: true,
          },
        },
        data: { url: link, roomId: ref.id },
      });

      // 실패 토큰 정리
      const bad: string[] = [];
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const errCode = (r.error && (r.error as any).code) || '';
          if (errCode.includes('registration-token-not-registered') || errCode.includes('invalid-argument')) {
            bad.push(chunk[idx]);
          }
        }
      });
      if (bad.length) await removeBadTokens(bad, byToken);
    }

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
