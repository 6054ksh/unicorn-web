import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

const TOPIC = 'all-members';
const DEFAULT_DURATION_MIN = 120; // endAt 없으면 startAt + 120분

export async function POST(req: Request) {
  try {
    // Admin SDK 준비
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const adminMessaging = getAdminMessaging();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 입력 파싱
    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'invalid-json' }, { status: 400 }); }

    const {
      title,
      location,
      capacity,
      startAt,
      endAt,               // ← 클라이언트가 안 보내도 됨(자동 보정)
      kakaoOpenChatUrl,    // 선택
      type,                // 선택(모임종류)
      content              // 선택(모임내용)
    } = body || {};

    // 필수값 검사
    const missing: string[] = [];
    if (!title?.toString().trim()) missing.push('title');
    if (!location?.toString().trim()) missing.push('location');

    const capNum = Number(capacity);
    if (!Number.isFinite(capNum) || capNum <= 0) missing.push('capacity');

    const start = new Date(startAt || '');
    if (isNaN(start.getTime())) missing.push('startAt');

    // endAt 자동 보정: 비었으면 startAt + 2시간
    let end: Date | null = null;
    if (endAt) {
      end = new Date(endAt);
      if (isNaN(end.getTime())) missing.push('endAt');
    } else if (!isNaN(start.getTime())) {
      end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60 * 1000);
    }

    if (missing.length) {
      return NextResponse.json({ error: 'missing fields', missing }, { status: 400 });
    }
    if (!(start < (end as Date))) {
      return NextResponse.json({ error: 'invalid datetime', hint: 'startAt < endAt 이어야 합니다.' }, { status: 400 });
    }

    const now = new Date();
    const revealAt = new Date(start.getTime() - 60 * 60 * 1000).toISOString(); // 모임 1시간 전 공개
    const joinLockUntil = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 개설 10분 동안 참여 금지

    const roomDoc = {
      title: String(title),
      titleLower: String(title).toLowerCase(),
      location: String(location),
      capacity: capNum,
      startAt: start.toISOString(),
      endAt: (end as Date).toISOString(),
      revealAt,
      joinLockUntil,
      kakaoOpenChatUrl: kakaoOpenChatUrl ? String(kakaoOpenChatUrl) : '',
      type: type ? String(type) : '',         // 선택 필드 저장
      content: content ? String(content) : '',// 선택 필드 저장
      creatorUid: uid,
      createdAt: now.toISOString(),
      participants: [] as string[],
      participantsCount: 0,
      closed: false,
    };

    // 방 생성 + 점수 반영
    const scoreRef = adminDb.collection('scores').doc(uid);
    const roomRef = adminDb.collection('rooms').doc();

    await adminDb.runTransaction(async (tx) => {
      const scoreSnap = await tx.get(scoreRef);
      const prev = scoreSnap.exists ? (scoreSnap.data() as any) : { total: 0, createdRooms: 0 };
      tx.set(roomRef, roomDoc);
      tx.set(
        scoreRef,
        {
          total: (prev.total || 0) + 30 + (roomDoc.capacity >= 8 ? 10 : 0),
          createdRooms: (prev.createdRooms || 0) + 1,
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    // 푸시(토픽 브로드캐스트)
    try {
      const titleText = `새 모임 방: ${roomDoc.title}`;
      const bodyText = `${new Date(roomDoc.startAt).toLocaleString()} • ${roomDoc.location} • 정원 ${roomDoc.capacity}명`;
      await adminMessaging.send({
        topic: TOPIC,
        notification: { title: titleText, body: bodyText },
        data: { type: 'NEW_ROOM', roomId: roomRef.id, title: roomDoc.title },
        webpush: {
          fcmOptions: {
            link: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/room/${roomRef.id}`,
          },
        },
      });
    } catch (e) {
      console.error('push error:', e);
    }

    return NextResponse.json({ ok: true, id: roomRef.id });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg === 'admin-not-initialized') {
      return NextResponse.json(
        { error: 'admin-not-initialized', hint: 'FIREBASE_* 환경변수 설정 후 서버 재시작 필요' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
