import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RoomRow = {
  id: string;
  title: string;
  location?: string;
  capacity?: number;
  minCapacity?: number;
  startAt?: string;
  endAt?: string;
  closed?: boolean;
  forcedClosedAt?: string;
  underMinClosedAt?: string;
  voteReminderSentAt?: string;
  votingOpen?: boolean;
  participants?: string[];
  participantsCount?: number;
};

function isoNow(): string {
  return new Date().toISOString();
}

function isAuthorized(req: Request): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true;
  const hdr = req.headers.get('authorization') || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
  return !!token && token === process.env.CRON_SECRET;
}

async function addUserNotificationsBoth(
  db: FirebaseFirestore.Firestore,
  uids: string[],
  payload: { type: string; title: string; body?: string; url?: string; createdAt?: string; meta?: any }
) {
  const now = payload.createdAt || isoNow();
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

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    const messaging = getAdminMessaging();
    const now = new Date();
    const nowIso = now.toISOString();

    // closed=false 인 방 전체 로드 (소규모 서비스 안전 폴백)
    const openSnap = await db.collection('rooms').where('closed', '==', false).get();
    const rooms: RoomRow[] = openSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // 최소인원 미달 처리 대상
    const underMinTargets = rooms.filter((r) => {
      const startOk = !!r.startAt && r.startAt <= nowIso;
      const hasMin = Number(r.minCapacity ?? 0) > 0;
      const joined = Number(r.participantsCount ?? (Array.isArray(r.participants) ? r.participants!.length : 0));
      const underMin = hasMin && joined < Number(r.minCapacity);
      const notForced = !r.forcedClosedAt;
      const notAlready = !r.underMinClosedAt;
      return !r.closed && startOk && underMin && notForced && notAlready;
    });

    // 종료 시각 도달 → 투표 알림
    const voteTargets = rooms.filter((r) => {
      const endOk = !!r.endAt && r.endAt <= nowIso;
      const notAlreadySent = !r.voteReminderSentAt;
      return !r.closed && endOk && notAlreadySent;
    });

    // (A) 최소인원 미달 처리
    for (const r of underMinTargets) {
      const participants = Array.isArray(r.participants) ? r.participants : [];
      const notifyUids = participants.length ? participants : [];
      const title = '아쉽게도 인원이 부족해서 모임이 종료되었어요 😢';
      const body = `『${r.title}』 — 최소인원 ${r.minCapacity}명을 채우지 못했어요. 다음에 다시 도전해요!`;

      if (notifyUids.length) {
        await addUserNotificationsBoth(db, notifyUids, { type: 'under-min-closed', title, body, url: '/room' });
        const { tokens, owners } = await fetchTokensForUsers(db, notifyUids);
        for (let i = 0; i < tokens.length; i += 500) {
          const chunk = tokens.slice(i, i + 500);
          const res = await messaging.sendEachForMulticast({
            tokens: chunk,
            webpush: {
              headers: { Urgency: 'high', TTL: '120' },
              fcmOptions: { link: '/room' },
              notification: { title, body, tag: 'under-min-closed', renotify: true },
            },
            data: { url: '/room' },
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

      // 방 문서: 종료로 마킹 (삭제 대신 기록 유지)
      const nowIso2 = isoNow();
      await db.collection('rooms').doc(r.id).set(
        { closed: true, underMinClosedAt: nowIso2, endAt: nowIso2, updatedAt: nowIso2, hiddenFromList: true },
        { merge: true }
      );
    }

    // (B) 종료 → 투표 알림 & "투표중" 마킹
    for (const r of voteTargets) {
      const participants = Array.isArray(r.participants) ? r.participants : [];
      const hasMembers = participants.length > 0;

      const nowIso2 = isoNow();
      await db.collection('rooms').doc(r.id).set(
        {
          closed: true,
          votingOpen: hasMembers ? true : false,
          voteReminderSentAt: nowIso2,
          endAt: r.endAt && r.endAt <= nowIso2 ? r.endAt : nowIso2,
          updatedAt: nowIso2,
        },
        { merge: true }
      );

      if (hasMembers) {
        const title = '투표할 시간이에요! 🗳️';
        const body = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요.`;
        const deepLink = `/room/${r.id}`;

        await addUserNotificationsBoth(db, participants, { type: 'vote-reminder', title, body, url: deepLink, meta: { roomId: r.id } });
        const { tokens, owners } = await fetchTokensForUsers(db, participants);
        for (let i = 0; i < tokens.length; i += 500) {
          const chunk = tokens.slice(i, i + 500);
          const res = await messaging.sendEachForMulticast({
            tokens: chunk,
            webpush: {
              headers: { Urgency: 'high', TTL: '120' },
              fcmOptions: { link: deepLink },
              notification: { title, body, tag: 'vote-reminder', renotify: true },
            },
            data: { url: deepLink },
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
    }

    return NextResponse.json({
      ok: true,
      now: nowIso,
      processed: {
        underMinClosed: underMinTargets.map((r) => r.id),
        voteReminded: voteTargets.map((r) => r.id),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export const POST = GET;
