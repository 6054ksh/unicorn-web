export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 인증 토큰
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // 요청 본문
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw httpError('invalid-json', 400);
    }
    const roomId = body?.roomId;
    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection('rooms').doc(roomId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);

      const data = snap.data() as any;
      const now = new Date();

      const start = data?.startAt ? new Date(data.startAt) : null;
      const ended = data?.endAt ? now >= new Date(data.endAt) : false;

      // 종료되었거나 이미 종료시간 지난 경우에는 나가기 불가
      if (data?.closed === true || ended) throw httpError('room-closed-or-ended', 400);

      // 시작 이후(혹은 정책: 시작 1시간 전부터) 금지로 바꾸고 싶으면 여기 조정
      // 예) 시작 1시간 전부터 금지:
      // if (start && now >= new Date(start.getTime() - 60 * 60 * 1000)) throw httpError('leave-locked', 400);
      if (start && now >= start) throw httpError('leave-not-allowed-after-start', 400);

      const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
      const beforeLen = participants.length;
      const after = participants.filter((p) => p !== uid);

      // 참여 중이 아니면 멱등 성공 처리
      if (after.length === beforeLen) return;

      tx.update(roomRef, {
        participants: after,
        participantsCount: after.length,
        updatedAt: now.toISOString(),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
