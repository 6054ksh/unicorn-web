export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { COL } from '@/lib/collections';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(() => ({}));
    let text = String(body?.text || '').trim();
    if (!text) throw httpError('text required', 400);
    if (text.length > 500) text = text.slice(0, 500);

    // 사용자 프로필 스냅샷(표시 편의)
    const userSnap = await db.collection(COL.users).doc(uid).get();
    const user = userSnap.exists ? userSnap.data() as any : {};
    const name = user?.name || '익명';
    const profileImage = user?.profileImage || '';

    const nowIso = new Date().toISOString();
    const docRef = await db.collection(COL.feedback).add({
      uid,
      name,
      profileImage,
      text,
      createdAt: nowIso,
      likesCount: 0,
      likedBy: [],
    });

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? String(e) }, { status });
  }
}
