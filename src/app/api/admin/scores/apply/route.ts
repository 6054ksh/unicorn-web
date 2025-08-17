import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

async function assertAdmin(uid: string) {
  const doc = await adminDb.collection('admins').doc(uid).get();
  if (!doc.exists || !doc.data()?.isAdmin) throw new Error('forbidden');
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);
    await assertAdmin(uid);

    const { targetUid, delta, reason } = await req.json();
    if (!targetUid || typeof delta !== 'number') {
      return NextResponse.json({ error: 'targetUid and numeric delta required' }, { status: 400 });
    }

    const scoreRef = adminDb.collection('scores').doc(String(targetUid));
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(scoreRef);
      const prev = snap.exists ? (snap.data() as any) : { total: 0 };
      tx.set(
        scoreRef,
        {
          total: (prev.total || 0) + delta,
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    // (선택) 조정 로그 기록
    await adminDb.collection('scoreAdjustLogs').add({
      by: uid,
      targetUid: String(targetUid),
      delta,
      reason: reason || '',
      at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? String(e) ;
    const status = msg === 'forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
