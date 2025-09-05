import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COL = {
  rooms: 'rooms',
  users: 'users',
  scores: 'scores',
  admins: 'admins',
} as const;

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

async function getBaseUrlServer(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://unicorn-web-git-main-6054kshs-projects.vercel.app';
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    // ---- 인증 ----
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    // ---- 입력 ----
    const body = await req.json();
    const title = String(body?.title || '').trim();
    const location = String(body?.location || '').trim();
    const capacity = Number(body?.capacity ?? 0);
    const minCapacity = Number(body?.minCapacity ?? 0);
    const startAtIso = String(body?.startAt || '').trim();
    const kakaoOpenChatUrl = (body?.kakaoOpenChatUrl ? String(body.kakaoOpenChatUrl).trim() : '') || null;
    const type = String(body?.type || '').trim();
    const content = String(body?.content || '').trim();

    const missing: string[] = [];
    if (!title) missing.push('title');
    if (!location) missing.push('location');
    if (!capacity) missing.push('capacity');
    if (!minCapacity) missing.push('minCapacity');
    if (!startAtIso) missing.push('startAt');
    if (missing.length) throw httpError(`missing fields: ${missing.join(',')}`, 400);

    if (!Number.isFinite(capacity) || capacity < 1) throw httpError('invalid capacity', 400);
    if (!Number.isFinite(minCapacity) || minCapacity < 1) throw httpError('invalid minCapacity', 400);
    if (minCapacity > capacity) throw httpError('minCapacity must be ≤ capacity', 400);

    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime())) throw httpError('invalid startAt', 400);

    // ---- 하루 1회 개설 제한(관리자 제외) ----
    const adminSnap = await db.collection(COL.admins).doc(uid).get();
    const isAdmin = adminSnap.exists && !!adminSnap.data()?.isAdmin;
    if (!isAdmin) {
      const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let blocked = false;
      try {
        const qs = await db
          .collection(COL.rooms)
          .where('creatorUid', '==', uid)
          .where('createdAt', '>=', cutoffIso)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        blocked = !qs.empty;
      } catch {
        const qs = await db.collection(COL.rooms).where('creatorUid', '==', uid).get();
        const last24h = qs.docs
          .map(d => d.data() as any)
          .filter(x => x?.createdAt && String(x.createdAt) >= cutoffIso);
        blocked = last24h.length > 0;
      }
      if (blocked) {
        return NextResponse.json(
          { error: 'daily-limit', message: '하루에 하나만 만들 수 있어요. 내일 다시 시도해 주세요.' },
          { status: 429 }
        );
      }
    }

    // ---- 자동 시간 ----
    const endAt = new Date(startAt.getTime() + 5 * 60 * 60 * 1000);   // +5h
    const revealAt = new Date(startAt.getTime() - 60 * 60 * 1000);    // -1h
    const nowIso = new Date().toISOString();

    // ---- 문서 생성 (생성자 자동 참여) ----
    const roomDoc = {
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
      participants: [uid] as string[],            // ← 자동 참여
      participantsCount: 1,                       // ← 자동 참여
      closed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const ref = await db.collection(COL.rooms).add(roomDoc);

    // ---- 점수(+30 / 정원≥8:+40) ----
    const plus = 30 + (capacity >= 8 ? 40 : 0);
    await db.collection(COL.scores).doc(uid).set({
      total: admin.firestore.FieldValue.increment(plus),
      createdRooms: admin.firestore.FieldValue.increment(1),
      lastUpdatedAt: nowIso,
    }, { merge: true });

    // ---- 새 모임 알림 (멀티캐스트) ----
    const usersSnap = await db.collection(COL.users).get();
    const tokens: string[] = [];
    const tokenOwners = new Map<string, string[]>();

    usersSnap.forEach(d => {
      const v = d.data() as any;
      const arr: string[] = Array.isArray(v?.fcmTokens) ? v.fcmTokens : [];
      for (const t of arr) {
        const tok = String(t || '').trim();
        if (!tok) continue;
        if (!tokenOwners.has(tok)) tokenOwners.set(tok, []);
        tokenOwners.get(tok)!.push(d.id);
        if (!tokens.includes(tok)) tokens.push(tok);
      }
    });

    if (tokens.length) {
      const base = await getBaseUrlServer();
      const link = `${base}/room/${ref.id}`;
      for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const resp = await messaging.sendEachForMulticast({
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

        // 불량 토큰 정리
        const bad: string[] = [];
        resp.responses.forEach((r, idx) => {
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
              const uref = db.collection(COL.users).doc(ownerUid);
              batch.update(uref, { fcmTokens: admin.firestore.FieldValue.arrayRemove(t) });
            }
          }
          await batch.commit().catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
