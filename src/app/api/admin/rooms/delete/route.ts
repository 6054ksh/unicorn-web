// src/app/api/admin/rooms/delete/route.ts
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

// 컬렉션 이름을 이 파일에서 직접 정의(필요하면 .env로 오버라이드 가능)
const ROOMS_COL = process.env.FIRESTORE_ROOMS_COL || 'rooms';
const ROOMS_ARCHIVE_COL = process.env.FIRESTORE_ROOMS_ARCHIVE_COL || 'rooms_archive';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 1) 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2) 어드민 체크
    const adminSnap = await db.collection('admins').doc(uid).get();
    if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
      throw httpError('forbidden:not-admin', 403);
    }

    // 3) 입력
    const body = await req.json().catch(() => ({}));
    const roomId = String(body?.roomId || '');
    const archive = body?.archive !== false; // 기본값: true
    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection(ROOMS_COL).doc(roomId);
    const archiveRef = db.collection(ROOMS_ARCHIVE_COL).doc(roomId);

    // 4) 트랜잭션: (선택) 보관 후 삭제
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);

      if (archive) {
        const data = snap.data() || {};
        tx.set(archiveRef, {
          ...data,
          archivedAt: new Date().toISOString(),
          archivedBy: uid,
        });
      }

      tx.delete(roomRef);
    });

    return NextResponse.json({ ok: true, archived: archive });
  } catch (e: any) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
