// src/app/api/rooms/close-now/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { addUserNotifications, fetchTokensForUsers, pushMulticast, removeBadTokens } from '@/lib/noti';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(() => ({}));
    const roomId = String(body?.roomId || '').trim();
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const ref = db.collection('rooms').doc(roomId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'room-not-found' }, { status: 404 });
    const r = snap.data() as any;

    const now = new Date();
    const endAt = r?.endAt ? new Date(r.endAt) : null;
    const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];

    const isParticipant = participants.includes(uid) || r?.creatorUid === uid;
    if (!isParticipant) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    if (!endAt || now < endAt) return NextResponse.json({ error: 'not-ended-yet' }, { status: 400 });
    if (r?.closed === true && r?.votingOpen === true) return NextResponse.json({ ok: true, already: true });

    const nowIso = new Date().toISOString();
    await ref.set(
      { closed: true, votingOpen: true, voteReminderSentAt: nowIso, updatedAt: nowIso },
      { merge: true }
    );

    if (participants.length) {
      const title = '투표할 시간이에요! 🗳️';
      const bodyMsg = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요.`;
      const url = `/room/${roomId}`;

      await addUserNotifications(participants, { type: 'vote-reminder', title, body: bodyMsg, url });
      const { tokens, owners } = await fetchTokensForUsers(participants);
      const res = await pushMulticast(tokens, { title, body: bodyMsg, url, tag: 'vote-reminder' });
      if (res.badTokens.length) await removeBadTokens(res.badTokens, owners);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
