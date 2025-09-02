export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { COL } from '@/lib/collections';
import * as admin from 'firebase-admin';

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
    const id = String(body?.id || '');
    if (!id) throw httpError('id required', 400);

    const ref = db.collection(COL.feedback).doc(id);

    let liked = false;
    let likesCount = 0;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw httpError('not-found', 404);
      const v = snap.data() as any;
      const likedBy: string[] = Array.isArray(v?.likedBy) ? v.likedBy : [];
      const already = likedBy.includes(uid);

      if (already) {
        tx.update(ref, {
          likedBy: admin.firestore.FieldValue.arrayRemove(uid),
          likesCount: admin.firestore.FieldValue.increment(-1),
        });
        liked = false;
        likesCount = Math.max(0, Number(v.likesCount || likedBy.length) - 1);
      } else {
        tx.update(ref, {
          likedBy: admin.firestore.FieldValue.arrayUnion(uid),
          likesCount: admin.firestore.FieldValue.increment(1),
        });
        liked = true;
        likesCount = Number(v.likesCount || likedBy.length) + 1;
      }
    });

    return NextResponse.json({ ok: true, liked, likesCount });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? String(e) }, { status });
  }
}
