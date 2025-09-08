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
  underMinClosedAt?: string;   // 과거 호환
  voteReminderSentAt?: string; // 투표 알림 보낸 시각
  votingOpen?: boolean;        // 투표 진행 중
  voteDeadlineAt?: string;     // endAt + 24h
  participants?: string[];
  participantsCount?: number;
  cancelledDueToMin?: boolean;
  hiddenFromList?: boolean;
};

type UserRow = {
  uid: string;
  name?: string;
  fcmTokens?: string[];
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

/** participants의 UID들로 users 문서를 읽어 FCM 토큰을 수집 */
async function fetchTokensForUsers(uids: string[], db: FirebaseFirestore.Firestore) {
  const unique = Array.from(new Set(uids)).filter(Boolean);
  const tokenOwners = new Map<string, string[]>(); // token -> [uid...]
  const allTokens: string[] = [];

  if (!unique.length) return { tokens: allTokens, owners: tokenOwners };

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.forEach((d) => {
      const v = d.data() as UserRow;
      const arr: string[] = Array.isArray(v?.fcmTokens) ? (v.fcmTokens as string[]) : [];
      for (const t of arr) {
        if (!t) continue;
        if (!tokenOwners.has(t)) tokenOwners.set(t, []);
        tokenOwners.get(t)!.push(d.id);
        if (!allTokens.includes(t)) allTokens.push(t);
      }
    });
  }

  return { tokens: allTokens, owners: tokenOwners };
}

async function removeBadTokens(badTokens: string[], owners: Map<string, string[]>, db: FirebaseFirestore.Firestore) {
  if (!badTokens.length) return;
  const batch = db.batch();

  for (const t of badTokens) {
    const uidList = owners.get(t) || [];
    for (const uid of uidList) {
      const ref = db.collection('users').doc(uid);
      batch.update(ref, { fcmTokens: admin.firestore.FieldValue.arrayRemove(t) });
    }
  }

  await batch.commit().catch(() => {});
}

async function addUserNotifications(
  uids: string[],
  payload: {
    type: string;
    title: string;
    body?: string;
    url?: string;
    createdAt?: string;
  },
  db: FirebaseFirestore.Firestore
) {
  const now = payload.createdAt || isoNow();
  const batch = db.batch();
  for (const uid of uids) {
    if (!uid) continue;
    const ref = db.collection('notifications').doc(uid).collection('items').doc();
    batch.set(ref, {
      id: ref.id,
      scope: 'user',
      unread: true,
      createdAt: now,
      ...payload,
    });
  }
  await batch.commit();
}

async function pushMulticast(tokens: string[], msg: { title: string; body?: string; url?: string; tag?: string }) {
  if (!tokens.length) return { success: 0, failure: 0, badTokens: [] as string[] };

  const messaging = getAdminMessaging();
  const badTokens: string[] = [];
  let success = 0;
  let failure = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      webpush: {
        headers: { Urgency: 'high', TTL: '120' },
        fcmOptions: msg.url ? { link: msg.url } : undefined,
        notification: { title: msg.title, body: msg.body || '', tag: msg.tag || undefined, renotify: true },
      },
      data: msg.url ? { url: msg.url } : undefined,
    });

    res.responses.forEach((r, idx) => {
      if (r.success) success += 1;
      else {
        failure += 1;
        const code = (r.error as any)?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          badTokens.push(chunk[idx]);
        }
      }
    });
  }

  return { success, failure, badTokens };
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    const now = new Date();
    const nowIso = now.toISOString();

    // 아직 종료되지 않은 방
    const openSnap = await db.collection('rooms').where('closed', '==', false).get();
    const rooms: RoomRow[] = openSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // 최소인원 미달 처리 타겟
    const underMinTargets = rooms.filter((r: RoomRow) => {
      const startOk = !!r.startAt && r.startAt <= nowIso;
      const hasMin = Number(r.minCapacity ?? 0) > 0;
      const joined = Number(r.participantsCount ?? (Array.isArray(r.participants) ? r.participants!.length : 0));
      const underMin = hasMin && joined < Number(r.minCapacity);
      const notForced = !r.forcedClosedAt;
      const notAlready = !r.cancelledDueToMin && !r.underMinClosedAt;
      return !r.closed && startOk && underMin && notForced && notAlready;
    });

    // 종료시각 도달 → 투표 알림 타겟
    const voteTargets = rooms.filter((r: RoomRow) => {
      const endOk = !!r.endAt && r.endAt <= nowIso;
      const notAlreadySent = !r.voteReminderSentAt;
      return !r.closed && endOk && notAlreadySent;
    });

    // (A) 최소인원 미달 처리
    for (const r of underMinTargets) {
      const participants = Array.isArray(r.participants) ? r.participants : [];
      const notifyUids = participants.length ? participants : [];

      // 상태 업데이트 (삭제하지 않음)
      const nowIso2 = isoNow();
      await db.collection('rooms').doc(r.id).set(
        {
          closed: true,
          cancelledDueToMin: true,
          hiddenFromList: true,
          updatedAt: nowIso2,
          underMinClosedAt: nowIso2,
        },
        { merge: true }
      );

      if (notifyUids.length) {
        const title = '아쉽게도 인원이 부족해서 모임이 종료되었어요 😢';
        const body = `『${r.title}』 — 최소인원 ${r.minCapacity}명을 채우지 못했어요. 다음에 다시 도전해요!`;
        await addUserNotifications(notifyUids, { type: 'under-min-closed', title, body, url: '/room' }, db);

        const { tokens, owners } = await fetchTokensForUsers(notifyUids, db);
        const res = await pushMulticast(tokens, { title, body, url: '/room', tag: 'under-min-closed' });
        if (res.badTokens.length) await removeBadTokens(res.badTokens, owners, db);
      }
    }

    // (B) 종료시각 도달 → 투표 알림 & 종료 마킹
    for (const r of voteTargets) {
      const participants = Array.isArray(r.participants) ? r.participants : [];
      const hasMembers = participants.length > 0;
      const nowIso2 = isoNow();

      // voteDeadlineAt 보강 (없으면 endAt + 24h)
      const voteDeadlineAt =
        r.voteDeadlineAt ||
        (r.endAt ? new Date(new Date(r.endAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      await db.collection('rooms').doc(r.id).set(
        {
          closed: true,
          votingOpen: hasMembers ? true : false,
          voteReminderSentAt: nowIso2,
          voteDeadlineAt,
          endAt: r.endAt && r.endAt <= nowIso2 ? r.endAt : nowIso2,
          updatedAt: nowIso2,
        },
        { merge: true }
      );

      if (hasMembers) {
        const title = '투표할 시간이에요! 🗳️';
        const body = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요.`;
        const deepLink = `/room/${r.id}`;

        await addUserNotifications(participants, { type: 'vote-reminder', title, body, url: deepLink }, db);

        const { tokens, owners } = await fetchTokensForUsers(participants, db);
        const res = await pushMulticast(tokens, { title, body, url: deepLink, tag: 'vote-reminder' });
        if (res.badTokens.length) await removeBadTokens(res.badTokens, owners, db);
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
