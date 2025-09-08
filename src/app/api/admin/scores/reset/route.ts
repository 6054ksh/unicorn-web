export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

async function assertAdmin(db: FirebaseFirestore.Firestore, uid: string) {
  const d = await db.collection('admins').doc(uid).get();
  if (!d.exists || !d.data()?.isAdmin) throw new Error('forbidden');
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 인증 + 관리자 확인
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);
    await assertAdmin(db, uid);

    const url = new URL(req.url);
    const confirm = url.searchParams.get('confirm') === '1';

    const snap = await db.collection('scores').get();
    if (!confirm) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        found: snap.size,
        hint: "실제 초기화하려면 ?confirm=1 붙여서 다시 호출하세요."
      });
    }

    // 500개씩 배치
    let done = 0;
    const all = snap.docs;
    for (let i = 0; i < all.length; i += 500) {
      const chunk = all.slice(i, i + 500);
      const batch = db.batch();
      chunk.forEach(d => {
        batch.set(d.ref, {
          total: 0,
          createdRooms: 0,
          joinedRooms: 0,
          thumbsCount: 0,
          heartsCount: 0,
          lastUpdatedAt: new Date().toISOString(),
        }, { merge: true });
      });
      await batch.commit();
      done += chunk.length;
    }

    return NextResponse.json({ ok: true, reset: done });
  } catch (e: any) {
    const status = e?.message === 'forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message ?? String(e) }, { status });
  }
}
