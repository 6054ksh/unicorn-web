// src/app/api/rooms/ensure/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

function isoNow() { return new Date().toISOString(); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok:false, error: msg }, { status }); }

async function isAdmin(db: FirebaseFirestore.Firestore, uid: string) {
  const s = await db.collection('admins').doc(uid).get();
  return s.exists && !!(s.data() as any)?.isAdmin;
}

async function addUserNotiBoth(
  db: FirebaseFirestore.Firestore,
  uids: string[],
  payload: { type: string; title: string; body?: string; url?: string; createdAt?: string; meta?: any }
) {
  const now = payload.createdAt || isoNow();
  const batch = db.batch();
  for (const uid of uids) {
    if (!uid) continue;
    const refA = db.collection('notifications').doc(uid).collection('items').doc();
    const doc = { id: refA.id, scope: 'user', unread: true, createdAt: now, ...payload };
    batch.set(refA, doc);
    const refB = db.collection('users').doc(uid).collection('notifications').doc(refA.id);
    batch.set(refB, doc);
  }
  await batch.commit();
}

async function fetchTokens(db: FirebaseFirestore.Firestore, uids: string[]) {
  const uniq = Array.from(new Set(uids)).filter(Boolean);
  const owners = new Map<string, string[]>(); // token -> [uid...]
  const tokens: string[] = [];
  for (let i=0;i<uniq.length;i+=10) {
    const chunk = uniq.slice(i, i+10);
    const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.forEach(d => {
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
  bad: string[],
  owners: Map<string, string[]>
) {
  if (!bad.length) return;
  const batch = db.batch();
  for (const t of bad) {
    for (const uid of owners.get(t) || []) {
      batch.update(db.collection('users').doc(uid), {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(t),
      });
    }
  }
  await batch.commit().catch(()=>{});
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    const authz = req.headers.get('authorization') || '';
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    if (!idToken) return bad('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(()=> ({}));
    const roomId = String(body?.roomId || '').trim();
    if (!roomId) return bad('roomId required', 400);

    const ref = db.collection('rooms').doc(roomId);
    const snap = await ref.get();
    if (!snap.exists) return bad('room-not-found', 404);
    const r = snap.data() as any;

    const now = new Date();
    const startAt = r?.startAt ? new Date(r.startAt) : null;
    const endAt = r?.endAt ? new Date(r.endAt) : null;
    const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
    const joined = Number(r?.participantsCount ?? participants.length ?? 0);
    const minCap = Number(r?.minCapacity ?? 0);

    // 권한 체크
    const allowed = participants.includes(uid) || r?.creatorUid === uid || await isAdmin(db, uid);
    if (!allowed) return bad('forbidden', 403);

    // 이미 최종 완료면 종료
    if (r?.voteComplete) return NextResponse.json({ ok:true, noop:true, state:'vote-complete' });

    // A) 최소인원 미달
    if (startAt && now >= startAt && r?.closed !== true && minCap > 0 && joined < minCap) {
      const nowIso = isoNow();
      await ref.set({
        closed: true,
        cancelledDueToMin: true,
        underMinClosedAt: nowIso,
        hiddenFromList: true,
        endAt: nowIso,
        updatedAt: nowIso,
      }, { merge: true });

      if (participants.length) {
        const title = '아쉽게도 인원이 부족해서 모임이 종료되었어요 🥺';
        const bodyMsg = `『${r.title}』 — 최소 ${minCap}명 필요, 현재 ${joined}명`;
        const url = '/room';

        await addUserNotiBoth(db, participants, { type: 'under-min-closed', title, body: bodyMsg, url, meta:{ roomId } });

        const { tokens, owners } = await fetchTokens(db, participants);
        for (let i=0;i<tokens.length;i+=500) {
          const chunk = tokens.slice(i, i+500);
          const res = await messaging.sendEachForMulticast({
            tokens: chunk,
            webpush: { headers: { Urgency: 'high', TTL: '120' }, fcmOptions: { link: url },
              notification: { title, body: bodyMsg, tag: 'under-min-closed', renotify: true } },
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
      return NextResponse.json({ ok:true, changed:'under-min-closed' });
    }

    // B) 종료 → 투표중
    if (endAt && now >= endAt && r?.closed !== true) {
      const nowIso = isoNow();
      await ref.set({
        closed: true,
        votingOpen: participants.length > 0 ? true : false,
        voteReminderSentAt: nowIso,
        updatedAt: nowIso,
      }, { merge: true });

      if (participants.length) {
        const title = '투표할 시간이에요! 🗳️';
        const bodyMsg = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요.`;
        const url = `/room/${roomId}`;

        await addUserNotiBoth(db, participants, { type: 'vote-reminder', title, body: bodyMsg, url, meta:{ roomId } });

        const { tokens, owners } = await fetchTokens(db, participants);
        for (let i=0;i<tokens.length;i+=500) {
          const chunk = tokens.slice(i, i+500);
          const res = await messaging.sendEachForMulticast({
            tokens: chunk,
            webpush: { headers: { Urgency: 'high', TTL: '120' }, fcmOptions: { link: url },
              notification: { title, body: bodyMsg, tag: 'vote-reminder', renotify: true } },
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
      // 계속 진행하여 C) 모두 투표완료 체크
    }

    // C) 모두 투표 완료 → 종료됨
    const fresh = await ref.get();
    const rr = fresh.data() as any;
    const pids: string[] = Array.isArray(rr?.participants) ? rr.participants : [];
    if (pids.length) {
      const vs = await ref.collection('votes').get();
      const votedCount = vs.size;
      if (votedCount >= pids.length) {
        const nowIso2 = isoNow();
        await ref.set({ voteComplete: true, votingOpen: false, updatedAt: nowIso2 }, { merge: true });
        return NextResponse.json({ ok:true, changed:'vote-complete' });
      }
    }

    return NextResponse.json({ ok:true, noop:true });
  } catch (e: any) {
    return bad(e?.message ?? String(e), e?.status ?? 500);
  }
}
