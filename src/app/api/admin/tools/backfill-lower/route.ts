import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

async function assertAdmin(uid: string) {
  const doc = await adminDb.collection('admins').doc(uid).get();
  if (!doc.exists || !doc.data()?.isAdmin) throw new Error('forbidden');
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);
    await assertAdmin(uid);

    // rooms: titleLower
    const roomsSnap = await adminDb.collection('rooms').get();
    let countRooms = 0;
    for (const doc of roomsSnap.docs) {
      const d = doc.data();
      const title = (d.title || '').toString();
      const titleLower = title.toLowerCase();
      if (d.titleLower !== titleLower) {
        await doc.ref.set({ titleLower }, { merge: true });
        countRooms++;
      }
    }

    // users: nameLower
    const usersSnap = await adminDb.collection('users').get();
    let countUsers = 0;
    for (const doc of usersSnap.docs) {
      const d = doc.data();
      const name = (d.name || '').toString();
      const nameLower = name.toLowerCase();
      if (d.nameLower !== nameLower) {
        await doc.ref.set({ nameLower }, { merge: true });
        countUsers++;
      }
    }

    return NextResponse.json({ ok: true, countRooms, countUsers });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = msg === 'forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
