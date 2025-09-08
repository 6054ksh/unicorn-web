import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const url = new URL(req.url);
    const uidParam = String(url.searchParams.get('uid') || '').trim();
    if (!uidParam) return NextResponse.json({ error: 'uid required' }, { status: 400 });

    // 인증은 있어도 되고 없어도 되지만, 기존 컨벤션을 따라 Bearer 있으면 검증
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.slice(7);
      await auth.verifyIdToken(idToken).catch(() => null);
    }

    const doc = await db.collection('users').doc(uidParam).get();
    if (!doc.exists) return NextResponse.json({ ok: true, uid: uidParam });

    const data = doc.data() as any;
    return NextResponse.json({
      ok: true,
      uid: uidParam,
      name: data?.name || null,
      profileImage: data?.profileImage || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
