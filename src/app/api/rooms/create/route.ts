export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { COL, RoomDoc } from '@/types/firestore';
import * as admin from 'firebase-admin';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // 바디
    const body = await req.json().catch(() => ({}));
    const missing: string[] = [];
    const title = (body?.title || '').trim();             if (!title) missing.push('title');
    const location = (body?.location || '').trim();       if (!location) missing.push('location');
    const capacity = Number(body?.capacity || 0);         if (!capacity || capacity < 1) missing.push('capacity');
    const startAtRaw = (body?.startAt || '').trim();      if (!startAtRaw) missing.push('startAt');
    if (missing.length) return NextResponse.json({ error: 'missing fields', missing }, { status: 400 });

    const startAt = new Date(startAtRaw);
    if (Number.isNaN(startAt.getTime())) throw httpError('invalid startAt', 400);

    // ---- 하루 1회 개설 제한 (관리자는 예외) ----
    const adminSnap = await db.collection(COL.admins).doc(uid).get();
    const isAdmin = adminSnap.exists && !!adminSnap.data()?.isAdmin;

    if (!isAdmin) {
      const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // creatorUid == uid & createdAt desc 1개 → createdAt 비교
      let blocked = false;
      try {
        const qs = await db.collection(COL.rooms)
          .where('creatorUid', '==', uid)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        const last = qs.docs[0];
        if (last) {
          const lastCreatedAt = (last.data() as any).createdAt as string | undefined;
          if (lastCreatedAt && lastCreatedAt >= cutoffIso) blocked = true;
        }
      } catch (e) {
        // 인덱스 문제나 예외 시, 넓게 조회 후 필터
        const qs = await db.collection(COL.rooms).where('creatorUid', '==', uid).get();
        const arr = qs.docs
          .map(d => d.data() as any)
          .filter(x => x?.createdAt)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        const last = arr[0];
        if (last && last.createdAt >= cutoffIso) blocked = true;
      }

      if (blocked) {
        return NextResponse.json(
          { error: 'daily-limit', message: '하루에 하나만 만들 수 있어요. 내일 다시 시도해 주세요.' },
          { status: 429 }
        );
      }
    }

    // ---- 자동 시간 계산 ----
    const endAt = new Date(startAt.getTime() + 5 * 60 * 60 * 1000);   // +5h
    const revealAt = new Date(startAt.getTime() - 60 * 60 * 1000);    // -1h
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

    // ---- 빠른 알림: 등록된 모든 토큰에 멀티캐스트 ----
    const usersSnap = await db.collection(COL.users).get();
    const tokens: string[] = [];
    const tokenOwners = new Map<string, string[]>(); // token -> [uid..]

    usersSnap.forEach(d => {
      const v = d.data() as any;
      const arr: string[] = Array.isArray(v?.fcmTokens) ? v.fcmTokens : [];
      arr.forEach(t => {
        if (!t) return;
        if (!tokenOwners.has(t)) tokenOwners.set(t, []);
        tokenOwners.get(t)!.push(d.id);
        if (!tokens.includes(t)) tokens.push(t);
      });
    });

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
            body: `『${title}』 — ${location} / 정원 ${capacity}명`,
            tag: 'room-created',
            renotify: true,
          },
        },
        data: { url: link, roomId: ref.id },
      });

      // 실패 토큰 제거
      const bad: string[] = [];
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = (r.error as any)?.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            bad.push(chunk[idx]);
          }
        }
      });
      if (bad.length) {
        const batch = db.batch();
        for (const t of bad) {
          const owners = tokenOwners.get(t) || [];
          for (const ownerUid of owners) {
            const ref = db.collection(COL.users).doc(ownerUid);
            batch.update(ref, { fcmTokens: admin.firestore.FieldValue.arrayRemove(t) });
          }
        }
        await batch.commit();
      }
    }

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
