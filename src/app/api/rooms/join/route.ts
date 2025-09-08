import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { notifyMany } from '@/lib/server/notify';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/** ─────────────────────────────
 * 유틸: 유저별 알림 저장(신/구 경로 모두)
 * ──────────────────────────── */
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

/** ─────────────────────────────
 * 유틸: 대상 유저들의 FCM 토큰 수집
 * ──────────────────────────── */
async function fetchTokensForUsers(db: FirebaseFirestore.Firestore, uids: string[]) {
  const unique = Array.from(new Set(uids)).filter(Boolean);
  const owners = new Map<string, string[]>(); // token -> [uid...]
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

/** ─────────────────────────────
 * 유틸: 잘못된 토큰 정리
 * ──────────────────────────── */
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

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // 본문
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw httpError('invalid-json', 400);
    }
    const roomId = body?.roomId;
    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection('rooms').doc(roomId);

    let prevParticipants: string[] = [];
    let creatorUid: string | undefined;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);

      const data = snap.data() as any;
      const now = new Date();

      if (data?.closed === true) throw httpError('room-closed', 400);
      if (data?.endAt && now >= new Date(data.endAt)) throw httpError('room-ended', 400);

      const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
      prevParticipants = participants.slice();
      creatorUid = data?.creatorUid;

      if (participants.includes(uid)) {
        // 이미 참여중 → 멱등 성공
        return;
      }

      const cap = typeof data?.capacity === 'number' ? data.capacity : undefined;
      if (cap && participants.length >= cap) throw httpError('room-full', 409);

      participants.push(uid);

      tx.update(roomRef, {
        participants,
        participantsCount: participants.length,
        updatedAt: now.toISOString(),
      });
    });

    // --- 기존 기능(레거시 notifyMany) 유지 ---
    const legacyTargets = Array.from(new Set([...prevParticipants, ...(creatorUid ? [creatorUid] : [])])).filter(
      (u) => u && u !== uid
    );
    if (legacyTargets.length) {
      await notifyMany(legacyTargets, {
        type: 'participant-joined',
        title: '내 모임에 친구가 들어왔어요! 🎈',
        body: '새로운 멤버가 참여했어요. 지금 확인해볼까요?',
        url: `/room/${roomId}`,
      });
    }

    // --- ✅ 유저별 알림 + FCM (신규 추가) ---
    // 갱신된 참가자/카운트를 반영하려면 최신 스냅샷을 사용
    const after = await roomRef.get();
    const room = after.data() as any;
    const participantsNow: string[] = Array.isArray(room?.participants) ? room.participants : [];
    const targets = participantsNow
      .concat(creatorUid ? [creatorUid] : [])
      .filter((u) => u && u !== uid); // 본인 제외

    if (targets.length) {
      const titleN = '새 멤버가 참여했어요 🎈';
      const bodyN = `『${room?.title ?? ''}』 — 지금 인원: ${Number(room?.participantsCount || participantsNow.length)}명`;
      const url = `/room/${roomId}`;

      // in-app 알림(신/구 경로 동시 기록)
      await addUserNotifications(db, targets, {
        type: 'participant-joined',
        title: titleN,
        body: bodyN,
        url,
        meta: { roomId }
      });

      // 푸시
      const { tokens, owners } = await fetchTokensForUsers(db, targets);
      if (tokens.length) {
        const messaging = getAdminMessaging();
        const res = await (async () => {
          const bad: string[] = [];
          let success = 0, failure = 0;
          for (let i = 0; i < tokens.length; i += 500) {
            const chunk = tokens.slice(i, i + 500);
            const r = await messaging.sendEachForMulticast({
              tokens: chunk,
              webpush: {
                headers: { Urgency: 'high', TTL: '120' },
                fcmOptions: { link: url },
                notification: { title: titleN, body: bodyN, tag: 'participant-joined', renotify: true },
              },
              data: { url },
            });
            r.responses.forEach((rr, idx) => {
              if (rr.success) success += 1;
              else {
                failure += 1;
                const code = (rr.error as any)?.code || '';
                if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
                  bad.push(chunk[idx]);
                }
              }
            });
          }
          return { success, failure, badTokens: bad };
        })();

        if (res.badTokens.length) await removeBadTokens(db, res.badTokens, owners);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
