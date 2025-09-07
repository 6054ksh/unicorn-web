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

    const url = new URL(req.url);
    const roomId = url.searchParams.get('roomId');
    if (!roomId) throw httpError('roomId required', 400);

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    const snap = await db.collection('rooms').doc(roomId).get();
    if (!snap.exists) return NextResponse.json({ ok: false, joined: false }, { status: 404 });

    const data = snap.data() as any;
    const arr: string[] = Array.isArray(data?.participants) ? data.participants : [];
    return NextResponse.json({ ok: true, joined: arr.includes(uid) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
