import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    // 최근 30일 내 방만 조회(부하 감소)
    const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let qs: FirebaseFirestore.QuerySnapshot;

    try {
      qs = await db
        .collection('rooms')
        .where('participants', 'array-contains', uid)
        .where('startAt', '>=', cutoffIso)
        .orderBy('startAt', 'desc')
        .limit(200)
        .get();
    } catch {
      // 인덱스 없을 때 폴백
      const all = await db.collection('rooms').where('participants', 'array-contains', uid).get();
      const docs = all.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => r?.startAt && r.startAt >= cutoffIso)
        .sort((a, b) => String(b.startAt).localeCompare(String(a.startAt)))
        .slice(0, 200);
      return NextResponse.json({ ok: true, ids: docs.map((d) => d.id) });
    }

    const ids = qs.docs.map((d) => d.id);
    return NextResponse.json({ ok: true, ids });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
