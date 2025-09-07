import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const col = db.collection('users').doc(uid).collection('notifications');

    // 여러 번에 나눠서 최대 수천 건도 안전하게 처리
    let updated = 0;
    const nowIso = new Date().toISOString();

    for (let i = 0; i < 10; i++) { // 안전 가드(최대 10*500=5,000개)
      const snap = await col.where('unread', '==', true).limit(500).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { unread: false, readAt: nowIso }));
      await batch.commit();
      updated += snap.size;
      if (snap.size < 500) break;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
