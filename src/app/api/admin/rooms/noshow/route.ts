import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

async function assertAdmin(uid: string) {
  const doc = await adminDb.collection('admins').doc(uid).get();
  if (!doc.exists || !doc.data()?.isAdmin) throw new Error('forbidden');
}

async function applyNoshow(roomId: string, targetUid: string) {
  const roomRef  = adminDb.collection('rooms').doc(roomId);
  const scoreRef = adminDb.collection('scores').doc(targetUid);
  const ledgerRef = roomRef.collection('scoreEvents').doc(`noshow:${targetUid}`);

  await adminDb.runTransaction(async (tx) => {
    const [roomSnap, ledgerSnap, scoreSnap] = await Promise.all([
      tx.get(roomRef),
      tx.get(ledgerRef),
      tx.get(scoreRef),
    ]);
    if (!roomSnap.exists) throw new Error('room not found');

    // 이미 적용했다면 중복 방지
    if (ledgerSnap.exists) throw new Error('already-applied');

    const r = roomSnap.data() as any;
    const participants: string[] = r.participants || [];
    if (!participants.includes(targetUid)) throw new Error('not-participant');

    const prev = scoreSnap.exists ? (scoreSnap.data() as any) : { total: 0, noShowCount: 0 };

    // 레저 기록 먼저 생성 → 이후 점수 반영
    tx.set(ledgerRef, {
      type: 'noshow',
      uid: targetUid,
      delta: -20,
      at: new Date().toISOString(),
    });

    tx.set(
      scoreRef,
      {
        total: (prev.total || 0) - 20,
        noShowCount: (prev.noShowCount || 0) + 1,
        lastUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);
    await assertAdmin(uid);

    const { roomId, uids } = await req.json();
    if (!roomId || !Array.isArray(uids) || uids.length === 0) {
      return NextResponse.json({ error: 'roomId and uids[] required' }, { status: 400 });
    }

    for (const target of uids) {
      await applyNoshow(roomId, String(target));
    }

    return NextResponse.json({ ok: true, count: uids.length });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const map: Record<string, number> = {
      'forbidden': 403,
      'room not found': 404,
      'already-applied': 409,
      'not-participant': 409,
    };
    return NextResponse.json({ error: msg }, { status: map[msg] || 500 });
  }
}
