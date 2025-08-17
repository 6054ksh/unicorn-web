import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid-json' }, { status: 400 }); }
    const roomId = body?.roomId;
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const roomRef = adminDb.collection('rooms').doc(roomId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) {
        const e: any = new Error('not-found'); e.status = 404; throw e;
      }
      const data = snap.data() as any;

      // 개설자만 종료 가능 (원하면 관리자가도 허용하도록 조건 추가)
      if (data.creatorUid !== uid) {
        const e: any = new Error('forbidden'); e.status = 403; throw e;
      }

      const now = new Date();
      const ttl = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (data.closed === true) {
        tx.update(roomRef, { ttlDeleteAt: ttl, endedByCreatorAt: now.toISOString() });
      } else {
        tx.update(roomRef, {
          closed: true,
          endAt: now.toISOString(),
          endedByCreatorAt: now.toISOString(),
          ttlDeleteAt: ttl,
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = e?.status ?? 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
