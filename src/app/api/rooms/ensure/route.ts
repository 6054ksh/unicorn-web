export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

// 공용: 사용자별 알림 파티션/레거시 둘 다 기록
async function addUserNotis(
  db: FirebaseFirestore.Firestore,
  uids: string[],
  payload: { type: string; title: string; body?: string; url?: string; createdAt?: string; meta?: any }
) {
  const now = payload.createdAt || new Date().toISOString();
  const batch = db.batch();
  for (const uid of uids) {
    if (!uid) continue;
    const a = db.collection('notifications').doc(uid).collection('items').doc();
    batch.set(a, { id: a.id, scope: 'user', unread: true, createdAt: now, ...payload });
    const b = db.collection('users').doc(uid).collection('notifications').doc(a.id);
    batch.set(b, { id: a.id, scope: 'user', unread: true, createdAt: now, ...payload });
  }
  await batch.commit();
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(() => ({}));
    const roomId = String(body?.roomId || '').trim();
    if (!roomId) throw httpError('roomId required', 400);

    const ref = db.collection('rooms').doc(roomId);
    const snap = await ref.get();
    if (!snap.exists) throw httpError('room-not-found', 404);

    const r = snap.data() as any;
    const now = new Date();
    const nowIso = now.toISOString();

    const startAt = r?.startAt ? new Date(r.startAt) : null;
    const endAt = r?.endAt ? new Date(r.endAt) : null;
    const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
    const joined = Number(r?.participantsCount ?? participants.length ?? 0);
    const minCap = Number(r?.minCapacity ?? 0);

    let changed = false;

    // 1) 최소인원 미달로 시작 시간 도달: 시작과 동시에 취소(삭제 X)
    if (!r?.closed && startAt && now >= startAt && minCap > 0 && joined < minCap) {
      await ref.set(
        {
          closed: true,
          cancelledDueToMin: true,
          abortedUnderMin: true,
          hiddenFromList: true, // 리스트 기본에서는 숨김
          endAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      changed = true;

      if (participants.length) {
        const title = '아쉽게도 인원이 부족해서 모임이 종료되었어요 🥺';
        const body = `『${r.title}』 — 최소 ${minCap}명 필요, 현재 ${joined}명`;
        const url = '/room';

        // in-app
        await addUserNotis(db, participants, { type: 'under-min-closed', title, body, url, meta: { roomId } });

        // 푸시
        const tokens: string[] = [];
        for (let i = 0; i < participants.length; i += 10) {
          const ch = participants.slice(i, i + 10);
          const us = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', ch).get();
          us.forEach((d) => {
            const arr: string[] = Array.isArray((d.data() as any)?.fcmTokens) ? (d.data() as any).fcmTokens : [];
            arr.forEach((t) => t && !tokens.includes(t) && tokens.push(t));
          });
        }
        if (tokens.length) {
          await messaging.sendEachForMulticast({
            tokens,
            webpush: { headers: { Urgency: 'high', TTL: '120' }, fcmOptions: { link: url }, notification: { title, body, tag: 'under-min-closed', renotify: true } },
            data: { url },
          });
        }
      }
    }

    // 2) 종료 시간 도달: 투표 개시(삭제 X)
    if (endAt && now >= endAt && r?.voteReminderSentAt == null) {
      await ref.set(
        {
          closed: true,
          votingOpen: participants.length > 0,
          voteReminderSentAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      changed = true;

      if (participants.length) {
        const title = '투표할 시간이에요! 🗳️';
        const body = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요.`;
        const url = `/room/${roomId}`;

        await addUserNotis(db, participants, { type: 'vote-reminder', title, body, url, meta: { roomId } });

        const tokens: string[] = [];
        for (let i = 0; i < participants.length; i += 10) {
          const ch = participants.slice(i, i + 10);
          const us = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', ch).get();
          us.forEach((d) => {
            const arr: string[] = Array.isArray((d.data() as any)?.fcmTokens) ? (d.data() as any).fcmTokens : [];
            arr.forEach((t) => t && !tokens.includes(t) && tokens.push(t));
          });
        }
        if (tokens.length) {
          await messaging.sendEachForMulticast({
            tokens,
            webpush: { headers: { Urgency: 'high', TTL: '120' }, fcmOptions: { link: url }, notification: { title, body, tag: 'vote-reminder', renotify: true } },
            data: { url },
          });
        }
      }
    }

    return NextResponse.json({ ok: true, changed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
