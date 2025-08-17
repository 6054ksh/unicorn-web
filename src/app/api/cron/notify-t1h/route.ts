import { NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const db = getAdminDb();
    const now = Date.now();
    const in1h = now + 60 * 60 * 1000;

    // 아직 종료되지 않았고, startAt이 1시간 이내, 그리고 remindSent != true
    const snap = await db.collection('rooms')
      .where('closed', '==', false)
      .get();

    const messaging = getAdminMessaging();
    let sent = 0;

    for (const doc of snap.docs) {
      const r: any = doc.data();
      const start = r?.startAt ? new Date(r.startAt).getTime() : null;
      if (!start) continue;
      if (start < now || start > in1h) continue;
      if (r?.remindT1hSent) continue;

      const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
      if (!participants.length) {
        await doc.ref.update({ remindT1hSent: true }); // 참여자 없으면 패스
        continue;
      }

      // 참가자들의 토큰 수집
      const tokens: string[] = [];
      const users = await db.getAll(...participants.map((uid) => db.collection('users').doc(uid)));
      users.forEach((uDoc) => {
        const arr: string[] = uDoc.get('tokens') || [];
        for (const t of arr) if (t && !tokens.includes(t)) tokens.push(t);
      });

      if (tokens.length) {
        await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: '모임 시작 1시간 전 ⏰',
            body: `${r.title} · ${r.location} · ${new Date(r.startAt).toLocaleString()}`,
          },
          data: { kind: 'room_remind_t1h', roomId: doc.id },
        });
        sent += tokens.length;
      }

      await doc.ref.update({ remindT1hSent: true });
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
