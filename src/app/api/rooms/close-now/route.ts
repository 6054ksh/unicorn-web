export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

async function addUserNotifications(
  db: FirebaseFirestore.Firestore,
  uids: string[],
  payload: { type: string; title: string; body?: string; url?: string; createdAt?: string; meta?: any }
) {
  const now = payload.createdAt || new Date().toISOString();
  const batch = db.batch();
  for (const uid of uids) {
    if (!uid) continue;
    const refA = db.collection('notifications').doc(uid).collection('items').doc();
    batch.set(refA, { id: refA.id, scope: 'user', unread: true, createdAt: now, ...payload });
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
    const roomId = String(body?.roomId || '').trim();
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const ref = db.collection('rooms').doc(roomId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'room-not-found' }, { status: 404 });
    const r = snap.data() as any;

    const now = new Date();
    const endAt = r?.endAt ? new Date(r.endAt) : null;
    const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];

    // 참여자/개설자만 종료 전환 허용
    if (![...(participants || []), r?.creatorUid].includes(uid)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    if (!endAt || now < endAt) return NextResponse.json({ error: 'not-ended-yet' }, { status: 400 });
    if (r?.closed === true && r?.votingOpen === true) return NextResponse.json({ ok: true, already: true });

    const nowIso = new Date().toISOString();
    await ref.set(
      { closed: true, votingOpen: true, voteReminderSentAt: nowIso, updatedAt: nowIso },
      { merge: true }
    );

    if ((participants || []).length) {
      const title = '투표할 시간이에요! 🗳️';
      const bodyMsg = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요.`;
      const url = `/room/${roomId}`;

      await addUserNotifications(db, participants, { type: 'vote-reminder', title, body: bodyMsg, url, meta: { roomId } });
      const { tokens, owners } = await fetchTokensForUsers(db, participants);
      for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const res = await messaging.sendEachForMulticast({
          tokens: chunk,
          webpush: {
            headers: { Urgency: 'high', TTL: '120' },
            fcmOptions: { link: url },
            notification: { title, body: bodyMsg, tag: 'vote-reminder', renotify: true },
          },
          data: { url },
        });
        const bad: string[] = [];
        res.responses.forEach((rr, idx) => {
          if (!rr.success) {
            const code = (rr.error as any)?.code || '';
            if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
              bad.push(chunk[idx]);
            }
          }
        });
        if (bad.length) await removeBadTokens(db, bad, owners);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
