// src/app/api/admin/feedback/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { COL, FeedbackDoc, FeedbackStatus } from '@/types/firestore';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // admin 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);
    const adminSnap = await db.collection(COL.admins).doc(uid).get();
    if (!adminSnap.exists || !adminSnap.data()?.isAdmin) {
      throw httpError('forbidden:not-admin', 403);
    }

    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || 'open') as FeedbackStatus | 'all';
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 500));

    let q = db.collection(COL.feedback).orderBy('createdAt', 'desc').limit(limit);
    if (status !== 'all') {
      q = q.where('status', '==', status);
    }
    const snap = await q.get();

    const list: FeedbackDoc[] = [];
    snap.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ ok: true, list });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
