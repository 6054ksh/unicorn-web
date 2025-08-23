import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { COL } from '@/types/firestore';

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const snap = await db.collection(COL.rooms).doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'not-found' }, { status: 404 });

    const room = { id: snap.id, ...(snap.data() as any) };
    const now = new Date();

    let participantsProfiles: Array<{ uid: string; name: string; profileImage?: string }> = [];
    if (room?.revealAt && now >= new Date(room.revealAt)) {
      const uids: string[] = Array.isArray(room.participants) ? room.participants : [];
      if (uids.length) {
        // 10개씩 in쿼리
        const usersCol = db.collection(COL.users);
        for (let i = 0; i < uids.length; i += 10) {
          const g = uids.slice(i, i + 10);
          const q = await usersCol.where('__name__', 'in', g).get();
          q.forEach(d => {
            const v = d.data() as any;
            participantsProfiles.push({ uid: d.id, name: v?.name || d.id, profileImage: v?.profileImage || '' });
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      room: { ...room, participantsProfiles },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
