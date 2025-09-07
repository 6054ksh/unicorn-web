import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const body = await req.json();
    const title = String(body?.title || '').trim();
    const location = String(body?.location || '').trim();
    const capacity = Number(body?.capacity ?? 0);
    const minCapacity = Number(body?.minCapacity ?? 0);
    const startAtIso = String(body?.startAt || '').trim();
    const endAtIso = body?.endAt ? String(body.endAt).trim() : ''; // 선택
    const kakaoOpenChatUrl = (body?.kakaoOpenChatUrl ? String(body.kakaoOpenChatUrl).trim() : '') || null;
    const type = String(body?.type || '').trim();
    const content = String(body?.content || '').trim();

    const missing: string[] = [];
    if (!title) missing.push('title');
    if (!location) missing.push('location');
    if (!capacity) missing.push('capacity');
    if (!minCapacity) missing.push('minCapacity');
    if (!startAtIso) missing.push('startAt');
    if (missing.length) throw httpError('missing fields', 400);

    if (!Number.isFinite(capacity) || capacity < 1) throw httpError('invalid capacity', 400);
    if (!Number.isFinite(minCapacity) || minCapacity < 1) throw httpError('invalid minCapacity', 400);
    if (minCapacity > capacity) throw httpError('minCapacity must be ≤ capacity', 400);

    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime())) throw httpError('invalid startAt', 400);

    // (선택) 사용자가 지정한 endAt 지원, 없으면 +5시간
    let endAt = endAtIso ? new Date(endAtIso) : new Date(startAt.getTime() + 5 * 60 * 60 * 1000);
    if (isNaN(endAt.getTime())) throw httpError('invalid endAt', 400);
    if (endAt <= startAt) throw httpError('endAt must be after startAt', 400);

    // 하루 1회 개설 제한 (admin 제외)
    const adminDoc = await db.collection('admins').doc(uid).get();
    const isAdmin = adminDoc.exists && !!adminDoc.data()?.isAdmin;
    if (!isAdmin) {
      const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let blocked = false;
      try {
        const qs = await db.collection('rooms')
          .where('creatorUid', '==', uid)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        const last = qs.docs[0];
        const lastCreatedAt = last?.data()?.createdAt as string | undefined;
        if (lastCreatedAt && lastCreatedAt >= cutoffIso) blocked = true;
      } catch {
        const qs = await db.collection('rooms').where('creatorUid', '==', uid).get();
        const arr = qs.docs
          .map(d => d.data() as any)
          .filter(x => x?.createdAt)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        const last = arr[0];
        if (last && last.createdAt >= cutoffIso) blocked = true;
      }
      if (blocked) {
        return NextResponse.json(
          { error: 'daily-limit', message: '하루에 하나만 만들 수 있어요. 내일 다시 시도해 주세요.' },
          { status: 429 }
        );
      }
    }

    const nowIso = new Date().toISOString();
    // ✅ 생성자 자동 참여
    const participants = [uid];

    const docRef = await db.collection('rooms').add({
      title,
      titleLower: title.toLowerCase(),
      type: type || null,
      content: content || null,
      location,
      capacity,
      minCapacity,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      revealAt: new Date(startAt.getTime() - 60 * 60 * 1000).toISOString(),
      kakaoOpenChatUrl,
      creatorUid: uid,
      participants,
      participantsCount: participants.length,
      closed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      voteOpen: false,
      voteDoneUids: [],
    });

    // 점수(+30 / 정원≥8:+40)
    const plus = 30 + (capacity >= 8 ? 40 : 0);
    await db.collection('scores').doc(uid).set({
      total: FieldValue.increment(plus),
      createdRooms: FieldValue.increment(1),
      lastUpdatedAt: nowIso,
    }, { merge: true });

    // (알림 전파 등은 기존 로직 유지)

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? String(e) },
      { status: e?.status ?? 500 }
    );
  }
}
