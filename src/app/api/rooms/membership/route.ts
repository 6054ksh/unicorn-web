// src/app/api/rooms/membership/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { FieldPath } from 'firebase-admin/firestore';

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { uid } = await auth.verifyIdToken(idToken);

    const url = new URL(req.url);
    const idsParam = url.searchParams.get('ids') || '';
    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);

    if (ids.length === 0) return NextResponse.json({ ok: true, map: {} });

    const map: Record<string, boolean> = {};
    ids.forEach((id) => (map[id] = false));

    // Firestore IN 쿼리 제한(<=10) 때문에 10개씩 끊어서 조회
    for (let i = 0; i < ids.length; i += 10) {
      const group = ids.slice(i, i + 10);
      const snap = await db
        .collection('rooms')
        .where(FieldPath.documentId(), 'in', group)
        .get();

      snap.forEach((doc) => {
        const data = doc.data() as any;
        const ps: string[] = Array.isArray(data?.participants) ? data.participants : [];
        map[doc.id] = ps.includes(uid);
      });
    }

    return NextResponse.json({ ok: true, map });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
