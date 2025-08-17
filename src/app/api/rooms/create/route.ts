import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging, adminFieldValue } from '@/lib/firebaseAdmin';

function bad(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const auth = getAdminAuth();
    const { uid } = await auth.verifyIdToken(idToken);

    const db = getAdminDb();
    const body = await req.json().catch(() => ({}));

    const { title, type, content, location, startAt, endAt, capacity, kakaoOpenChatUrl } = body || {};
    const missing: string[] = [];
    if (!title) missing.push('title');
    if (!location) missing.push('location');
    if (!startAt) missing.push('startAt');
    if (!endAt) missing.push('endAt');
    if (!capacity) missing.push('capacity');
    if (missing.length) throw bad('missing fields: ' + missing.join(','), 400);

    const now = new Date();
    const joinLockUntil = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 개설 후 10분 잠금
    const revealAt = new Date(new Date(startAt).getTime() - 60 * 60 * 1000).toISOString(); // 시작 1시간 전

    const docRef = await db.collection('rooms').add({
      title, type: type || '', content: content || '',
      location, startAt, endAt, capacity,
      kakaoOpenChatUrl: kakaoOpenChatUrl || '',
      participants: [],
      participantsCount: 0,
      joinLockUntil,
      revealAt,
      closed: false,
      creatorUid: uid,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    // 점수(방 개설 30점 등)는 별도 컬렉션/로직에서 처리했다면 여기서 increment 해도 됨.
    // 예) db.collection('scores').doc(uid).set({ score: adminFieldValue.increment(30) }, { merge: true })

    // 🔔 전체 브로드캐스트
    const usersSnap = await db.collection('users').get();
    const tokens: string[] = [];
    usersSnap.forEach((u) => {
      const arr: string[] = u.get('tokens') || [];
      for (const t of arr) if (t && !tokens.includes(t)) tokens.push(t);
    });

    if (tokens.length) {
      const messaging = getAdminMessaging();
      await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: '새 모임이 개설되었어요 🎉',
          body: `${title} · ${location} · 정원 ${capacity}명`,
        },
        data: { kind: 'room_created', roomId: docRef.id },
      });
    }

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? String(e) }, { status });
  }
}
