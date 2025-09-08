import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function addUserNotifications(
  db: FirebaseFirestore.Firestore,
  uids: string[],
  payload: { type: string; title: string; body?: string; url?: string; createdAt?: string; meta?: any }
) {
  const now = payload.createdAt || new Date().toISOString();
  const batch = db.batch();
  for (const uid of uids) {
    if (!uid) continue;
    // 최신 경로
    const refA = db.collection('notifications').doc(uid).collection('items').doc();
    batch.set(refA, { id: refA.id, scope: 'user', unread: true, createdAt: now, ...payload });
    // 레거시 경로(호환)
    const refB = db.collection('users').doc(uid).collection('notifications').doc(refA.id);
    batch.set(refB, { id: refA.id, scope: 'user', unread: true, createdAt: now, ...payload });
  }
  await batch.commit();
}

async function fetchTokensForUsers(db: FirebaseFirestore.Firestore, uids: string[]) {
  const unique = Array.from(new Set(uids)).filter(Boolean);
  const owners = new Map<string, string[]>();
  const tokens: string[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    snap.forEach((d) => {
      const arr: string[] = Array.isArray((d.data() as any)?.fcmTokens) ? (d.data() as any).fcmTokens : [];
      for (const t of arr) {
        if (!t) continue;
        if (!owners.has(t)) owners.set(t, []);
        owners.get(t)!.push(d.id);
        if (!tokens.includes(t)) tokens.push(t);
      }
    });
  }
  return { tokens, owners };
}

async function removeBadTokens(
  db: FirebaseFirestore.Firestore,
  badTokens: string[],
  owners: Map<string, string[]>
) {
  if (!badTokens.length) return;
  const batch = db.batch();
  for (const t of badTokens) {
    for (const uid of owners.get(t) || []) {
      batch.update(db.collection('users').doc(uid), {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(t),
      });
    }
  }
  await batch.commit().catch(() => {});
}

async function pushMulticast(
  tokens: string[],
  msg: { title: string; body?: string; url?: string; tag?: string }
) {
  const messaging = getAdminMessaging();
  if (!tokens.length) return { badTokens: [] as string[] };
  const bad: string[] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      webpush: {
        headers: { Urgency: 'high', TTL: '120' },
        fcmOptions: msg.url ? { link: msg.url } : undefined,
        notification: { title: msg.title, body: msg.body || '', tag: msg.tag, renotify: true },
      },
      data: msg.url ? { url: msg.url } : undefined,
    });
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = (r.error as any)?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          bad.push(chunk[idx]);
        }
      }
    });
  }
  return { badTokens: bad };
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return bad('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);
    if (!uid) return bad('unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const roomId: string = String(body?.roomId || '').trim();
    if (!roomId) return bad('roomId required', 400);

    const ref = db.collection('rooms').doc(roomId);
    const snap = await ref.get();
    if (!snap.exists) return bad('room-not-found', 404);

    const r = snap.data() as any;
    const now = new Date();
    const nowIso = now.toISOString();
    const startAt = r?.startAt ? new Date(r.startAt) : null;
    const endAt = r?.endAt ? new Date(r.endAt) : null;
    const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
    const joined = Number(r?.participantsCount ?? participants.length ?? 0);
    const minCap = Number(r?.minCapacity ?? 0);

    // (A) 최소인원 미달: 시작 시각 도달 && closed=false && 참여<최소 && 아직 처리 안함
    if (!r?.closed && startAt && now >= startAt && minCap > 0 && joined < minCap && !r?.abortedUnderMin) {
      await ref.set(
        { closed: true, abortedUnderMin: true, endAt: nowIso, updatedAt: nowIso },
        { merge: true }
      );

      if (participants.length) {
        const title = '아쉽게도 인원이 부족해서 모임이 종료되었어요 😢';
        const bodyTxt = `『${r.title}』 — 최소 ${minCap}명 필요, 현재 ${joined}명`;
        const url = '/room';

        await addUserNotifications(db, participants, {
          type: 'under-min-closed',
          title,
          body: bodyTxt,
          url,
          meta: { roomId },
        });

        const { tokens, owners } = await fetchTokensForUsers(db, participants);
        const pushRes = await pushMulticast(tokens, { title, body: bodyTxt, url, tag: 'under-min-closed' });
        if (pushRes.badTokens.length) await removeBadTokens(db, pushRes.badTokens, owners);
      }

      return NextResponse.json({ ok: true, action: 'under-min-closed' });
    }

    // (B) 종료 시각 도달: closed=false && endAt<=now → 종료+투표오픈+알림
    if (!r?.closed && endAt && now >= endAt && !r?.votingOpen) {
      await ref.set(
        {
          closed: true,
          votingOpen: participants.length > 0, // 참여자가 있을 때만 투표 열기
          voteReminderSentAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      if (participants.length) {
        const title = '투표할 시간이에요! 🗳️';
        const bodyTxt = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요.`;
        const url = `/room/${roomId}`;

        await addUserNotifications(db, participants, {
          type: 'vote-reminder',
          title,
          body: bodyTxt,
          url,
          meta: { roomId },
        });

        const { tokens, owners } = await fetchTokensForUsers(db, participants);
        const pushRes = await pushMulticast(tokens, { title, body: bodyTxt, url, tag: 'vote-reminder' });
        if (pushRes.badTokens.length) await removeBadTokens(db, pushRes.badTokens, owners);
      }

      return NextResponse.json({ ok: true, action: 'vote-opened' });
    }

    return NextResponse.json({ ok: true, action: 'noop' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
