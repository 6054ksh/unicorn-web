export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { notifyMany } from '@/lib/server/notify';

/**
 * 트리거 방식:
 * - 배치/크론이 이 엔드포인트를 5~10분 간격으로 호출
 * - endAt이 현재시각 기준 과거 30분 이내인 room 중, closed=false 인 방을 대상으로 참가자에게 투표 알림
 *   (이미 알림 보냈는지 표식을 남기려면, rooms/{id}.voteReminderSent: true 로 기록)
 */
export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // (선택) 보호: 어드민만 허용
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);
    const asnap = await db.collection('admins').doc(uid).get();
    if (!asnap.exists || !asnap.data()?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const now = Date.now();
    const windowStart = new Date(now - 30 * 60 * 1000).toISOString(); // 30분 전
    const windowEnd = new Date(now + 1 * 60 * 1000).toISOString();    // 약간의 버퍼

    // endAt 범위를 한 번에 쿼리(인덱스 필요할 수 있음)
    let qs;
    try {
      qs = await db
        .collection('rooms')
        .where('endAt', '>=', windowStart)
        .where('endAt', '<=', windowEnd)
        .where('closed', '==', false)
        .limit(50)
        .get();
    } catch {
      // 인덱스 없으면 폴백: 전체에서 필터(소규모 용)
      const all = await db.collection('rooms').get();
      qs = {
        docs: all.docs.filter((d) => {
          const v = d.data() as any;
          const endAt = new Date(v?.endAt || 0).toISOString();
          return v?.closed === false && endAt >= windowStart && endAt <= windowEnd;
        }),
      } as any;
    }

    let count = 0;
    for (const doc of qs.docs) {
      const v = doc.data() as any;
      if (v?.voteReminderSent) continue;
      const participants: string[] = Array.isArray(v?.participants) ? v.participants : [];
      if (!participants.length) continue;

      // 알림 전송
      await notifyMany(participants, {
        type: 'vote-reminder',
        title: '투표 시간이 도착했어요! 🗳️',
        body: `『${v?.title || '모임'}』 투표에 참여해 주세요.`,
        url: `/room/${doc.id}`,
      });

      // 중복 방지 플래그
      await doc.ref.update({ voteReminderSent: true, updatedAt: new Date().toISOString() });
      count += participants.length;
    }

    return NextResponse.json({ ok: true, notifiedUsers: count });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
