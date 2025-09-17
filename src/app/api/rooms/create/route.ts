// src/app/api/rooms/create/route.ts
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { callKakaoChannelAPI, KakaoEventUser } from '@/lib/server/kakaoChannel';
import { pushGlobal } from '@/lib/server/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
 * 유틸: 대상 유저들의 FCM 토큰 수집 (10개 in쿼리 분할)
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

/** ─────────────────────────────
 * 유틸: 멀티캐스트 푸시
 * ──────────────────────────── */
async function pushMulticast(
  messaging: ReturnType<typeof getAdminMessaging>,
  tokens: string[],
  msg: { title: string; body?: string; url?: string; tag?: string }
) {
  if (!tokens.length) return { success: 0, failure: 0, badTokens: [] as string[] };
  const bad: string[] = [];
  let success = 0;
  let failure = 0;
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
    success += res.successCount;
    failure += res.failureCount;

    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = (r.error as any)?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          bad.push(chunk[idx]);
        }
      }
    });
  }
  return { success, failure, badTokens: bad };
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    // 입력
    const body = await req.json();
    const title = String(body?.title || '').trim();
    const location = String(body?.location || '').trim();
    const capacity = Number(body?.capacity ?? 0);
    const minCapacity = Number(body?.minCapacity ?? 0);
    const startAtIso = String(body?.startAt || '').trim(); // ISO
    const endAtIso = String(body?.endAt || '').trim();     // ISO (옵션, 없으면 +5h)
    const kakaoOpenChatUrl = (body?.kakaoOpenChatUrl ? String(body.kakaoOpenChatUrl).trim() : '') || null;
    const type = String(body?.type || '').trim();
    const content = String(body?.content || '').trim();

    const missing: string[] = [];
    if (!title) missing.push('title');
    if (!location) missing.push('location');
    if (!capacity) missing.push('capacity');
    if (!minCapacity) missing.push('minCapacity');
    if (!startAtIso) missing.push('startAt');
    if (missing.length) throw httpError('missing fields', 400);

    if (!Number.isFinite(capacity) || capacity < 1) throw httpError('invalid capacity', 400);
    if (!Number.isFinite(minCapacity) || minCapacity < 1) throw httpError('invalid minCapacity', 400);
    if (minCapacity > capacity) throw httpError('minCapacity must be ≤ capacity', 400);

    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime())) throw httpError('invalid startAt', 400);

    const endAt = endAtIso
      ? new Date(endAtIso)
      : new Date(startAt.getTime() + 5 * 60 * 60 * 1000);
    if (isNaN(endAt.getTime())) throw httpError('invalid endAt', 400);

    const revealAt = new Date(startAt.getTime() - 60 * 60 * 1000); // 그대로 유지

    // ---- 하루 1회 개설 제한 (관리자는 예외) ----
    const adminSnap = await db.collection('admins').doc(uid).get();
    const isAdmin = adminSnap.exists && !!adminSnap.data()?.isAdmin;

    if (!isAdmin) {
      const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let blocked = false;
      try {
        const qs = await db
          .collection('rooms')
          .where('creatorUid', '==', uid)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        const last = qs.docs[0];
        if (last) {
          const lastCreatedAt = (last.data() as any).createdAt as string | undefined;
          if (lastCreatedAt && lastCreatedAt >= cutoffIso) blocked = true;
        }
      } catch {
        const qs = await db.collection('rooms').where('creatorUid', '==', uid).get();
        const arr = qs.docs
          .map((d) => d.data() as any)
          .filter((x) => x?.createdAt)
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

    const nowIso = new Date().toISOString();

    // 생성자 자동 참여 + 방 저장
    const data = {
      title,
      titleLower: title.toLowerCase(),
      type: type || null,
      content: content || null,
      location,
      capacity,
      minCapacity,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      revealAt: revealAt.toISOString(),
      kakaoOpenChatUrl,
      creatorUid: uid,
      participants: [uid],
      participantsCount: 1,
      closed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const ref = await db.collection('rooms').add(data);

    // 점수(+30 / 정원≥8:+40) - 생성자
    const plus = 30 + (capacity >= 8 ? 40 : 0);
    await db
      .collection('scores')
      .doc(uid)
      .set(
        {
          total: admin.firestore.FieldValue.increment(plus),
          createdRooms: admin.firestore.FieldValue.increment(1),
          lastUpdatedAt: nowIso,
        },
        { merge: true }
      );

    // --- 글로벌 알림(벨 패널) ---
    await pushGlobal({
      type: 'room-created',
      title: '새로운 모임이 추가되었습니다! 🎉',
      body: `『${title}』 — ${location} / 정원 ${capacity}명`,
      url: `/room/${ref.id}`,
    });

    // --- 전체 사용자 In-App + FCM ---
    const everyone = await db.collection('users').get();
    const allUids = everyone.docs.map(d => d.id);

    if (allUids.length) {
      const titleN = '새 모임이 올라왔어요 🎉';
      const bodyN = `『${title}』 — 지금 참여해보세요!`;
      const urlPath = `/room/${ref.id}`;

      // In-app 알림(신/구 경로 동시 기록)
      await addUserNotifications(db, allUids, {
        type: 'room-created',
        title: titleN,
        body: bodyN,
        url: urlPath,
        meta: { roomId: ref.id }
      });

      // 푸시
      const { tokens, owners } = await fetchTokensForUsers(db, allUids);
      const res = await pushMulticast(messaging, tokens, {
        title: titleN,
        body: bodyN,
        url: urlPath,
        tag: 'room-created'
      });
      if (res.badTokens.length) await removeBadTokens(db, res.badTokens, owners);
    }

    // --- Kakao 채널(오픈빌더) room_created 이벤트 ---
    try {
      // kakaoAppUserId가 저장된 유저만 대상
      const kakaoUsersSnap = await db.collection('users')
        .where('kakaoAppUserId', '>', '')
        .get();

      const kakaoTargets: KakaoEventUser[] = kakaoUsersSnap.docs
        .map(d => String((d.data() as any).kakaoAppUserId || ''))
        .filter(Boolean)
        .map(id => ({ idType: 'appUserId', id }));

      if (kakaoTargets.length) {
        const startAtKST = new Intl.DateTimeFormat('ko-KR', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Seoul'
        }).format(startAt);

        const base =
          (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '')) ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

        await callKakaoChannelAPI('room_created', kakaoTargets, {
          title,
          location,
          startAtKST,
          url: base ? `${base}/room/${ref.id}` : `/room/${ref.id}`,
          roomId: ref.id,
        });
      }
    } catch (err) {
      console.error('Kakao room_created event send failed:', err);
    }

    // --- 익명 브로드캐스트 토큰 대상 FCM ---
    try {
      const anonSnap = await db.collection('broadcastTokens').where('enabled', '==', true).get();
      const anonTokens = anonSnap.docs.map(d => (d.data() as any).token).filter(Boolean);
      if (anonTokens.length) {
        const bad: string[] = [];
        for (let i = 0; i < anonTokens.length; i += 500) {
          const chunk = anonTokens.slice(i, i + 500);
          const r = await messaging.sendEachForMulticast({
            tokens: chunk,
            webpush: {
              headers: { Urgency: 'high', TTL: '120' },
              fcmOptions: { link: `/room/${ref.id}` },
              notification: {
                title: '🦄 새 모임이 올라왔어요!',
                body: `『${title}』 — ${location} / 정원 ${capacity}명`,
                tag: 'room-created',
                renotify: true,
              },
            },
            data: { url: `/room/${ref.id}` },
          });
          r.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const code = (resp.error as any)?.code || '';
              if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
                bad.push(chunk[idx]);
              }
            }
          });
        }

        if (bad.length) {
          const batch = db.batch();
          bad.forEach(t => batch.delete(db.collection('broadcastTokens').doc(t)));
          await batch.commit();
        }
      }
    } catch (e) {
      // 익명 발송 실패는 전체 실패로 만들지 않음
      console.warn('broadcastTokens send failed', e);
    }

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: e?.status ?? 500 }
    );
  }
}
