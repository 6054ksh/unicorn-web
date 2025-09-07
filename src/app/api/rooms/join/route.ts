import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { notifyMany } from '@/lib/server/notify';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
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

    // --- 참여 알림 (본인 제외) ---
    const targets = Array.from(new Set([...prevParticipants, ...(creatorUid ? [creatorUid] : [])])).filter(
      (u) => u && u !== uid
    );
    if (targets.length) {
      await notifyMany(targets, {
        type: 'participant-joined',
        title: '내 모임에 친구가 들어왔어요! 🎈',
        body: '새로운 멤버가 참여했어요. 지금 확인해볼까요?',
        url: `/room/${roomId}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
