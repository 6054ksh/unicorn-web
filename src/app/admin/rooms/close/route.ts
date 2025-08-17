import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

async function assertAdmin(uid: string) {
  const adminDb = getAdminDb();
  const doc = await adminDb.collection('admins').doc(uid).get();
  if (!doc.exists || !doc.data()?.isAdmin) {
    const err: any = new Error('forbidden');
    err.status = 403;
    throw err;
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, version: 'admin/rooms/close v2 (ttl)' });
}

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);
    await assertAdmin(uid);

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid-json' }, { status: 400 }); }
    const roomId = body?.roomId;
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const roomRef = adminDb.collection('rooms').doc(roomId);
    let alreadyClosed = false;

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) {
        const e: any = new Error('not-found'); e.status = 404; throw e;
      }
      const data = snap.data() as any;
      const now = new Date();

      let newEnd = now;
      if (data?.endAt) {
        const prevEnd = new Date(data.endAt);
        if (!isNaN(prevEnd.getTime()) && prevEnd > now) {
          newEnd = now; // 강제 종료니까 이제부터 종료로 간주
        } else if (!isNaN(prevEnd.getTime())) {
          newEnd = prevEnd; // 이전 종료 시간이 이미 있다면 그대로 사용
        }
      }

      const ttl = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000); // 종료 + 24시간

      if (data?.closed === true) {
        alreadyClosed = true;
        tx.update(roomRef, {
          forcedClosedAt: now.toISOString(),
          ttlDeleteAt: ttl, // JS Date로 넣으면 Timestamp로 저장
        });
      } else {
        tx.update(roomRef, {
          closed: true,
          endAt: newEnd.toISOString(),
          forcedClosedAt: now.toISOString(),
          ttlDeleteAt: ttl,
        });
      }
    });

    return NextResponse.json({ ok: true, alreadyClosed });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg === 'admin-not-initialized') {
      return NextResponse.json({ error: 'admin-not-initialized' }, { status: 500 });
    }
    if (msg === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (msg === 'not-found') return NextResponse.json({ error: 'room-not-found' }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
