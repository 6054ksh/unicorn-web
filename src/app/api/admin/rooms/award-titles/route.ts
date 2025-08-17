import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

async function assertAdmin(uid: string) {
  const doc = await adminDb.collection('admins').doc(uid).get();
  if (!doc.exists || !doc.data()?.isAdmin) throw new Error('forbidden');
}

const TITLE_MAP: Record<string, string> = {
  komangshot: '코맹샷',
  allTimeLegend: '올타임레전드',
  playmaker: '플레이메이커',
};

export async function POST(req: Request) {
  try {
    // 1) 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);
    await assertAdmin(uid);

    // 2) 입력
    const { roomId, awards } = await req.json();
    // awards 예: { komangshot: "uid1", allTimeLegend: "uid2", playmaker: "uid3" }
    if (!roomId || !awards || typeof awards !== 'object') {
      return NextResponse.json({ error: 'roomId and awards required' }, { status: 400 });
    }

    const roomRef = adminDb.collection('rooms').doc(roomId);
    const ledgerRef = roomRef.collection('award').doc('applied');

    await adminDb.runTransaction(async (tx) => {
      // ---------- 모든 READ 먼저 ----------
      const [roomSnap, awardSnap] = await Promise.all([tx.get(roomRef), tx.get(ledgerRef)]);
      if (!roomSnap.exists) throw new Error('room not found');
      if (awardSnap.exists) throw new Error('already-awarded');

      const r = roomSnap.data() as any;
      const participants: string[] = r.participants || [];

      // 수여 대상 정리 + 유효성 검증(참여자 여부)
      const updates: Array<{ uid: string; titleKo: string }> = [];
      for (const key of Object.keys(awards)) {
        const targetUid = String(awards[key] ?? '');
        if (!targetUid) continue;
        if (!participants.includes(targetUid)) throw new Error(`not-participant:${targetUid}`);
        const titleKo = TITLE_MAP[key] || key;
        updates.push({ uid: targetUid, titleKo });
      }
      if (updates.length === 0) throw new Error('no-awards');

      // 사용자 문서들 미리 전부 READ
      const userRefs = updates.map(u => adminDb.collection('users').doc(u.uid));
      const userSnaps = await Promise.all(userRefs.map(ref => tx.get(ref)));

      // 각 사용자 tempTitles 계산
      const nextTitlesByUid: Record<string, string[]> = {};
      userSnaps.forEach((snap, idx) => {
        const u = updates[idx];
        const prev = snap.exists ? (snap.data() as any) : {};
        const prevTitles: string[] = Array.isArray(prev?.tempTitles) ? prev.tempTitles : [];
        const next = Array.from(new Set([...prevTitles, u.titleKo]));
        nextTitlesByUid[u.uid] = next;
      });

      // ---------- 이제부터 WRITE ----------
      // 방 문서에 수여 내역 기록
      tx.set(
        roomRef,
        {
          awards: Object.fromEntries(updates.map(u => [u.titleKo, u.uid])),
          awardedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 각 사용자 tempTitles 업데이트
      updates.forEach((u, i) => {
        const ref = userRefs[i];
        tx.set(
          ref,
          { tempTitles: nextTitlesByUid[u.uid], updatedAt: new Date() },
          { merge: true }
        );
      });

      // 중복 수여 방지 플래그
      tx.set(ledgerRef, { appliedAt: new Date().toISOString() });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const map: Record<string, number> = {
      'forbidden': 403,
      'room not found': 404,
      'already-awarded': 409,
      'no-awards': 400,
    };
    // not-participant:<uid> 는 409로 반환
    const status = map[msg] || (String(msg).startsWith('not-participant') ? 409 : 500);
    return NextResponse.json({ error: msg }, { status });
  }
}
