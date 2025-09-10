export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const { accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken required' }, { status: 400 });
    }

    const meResp = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const me = await meResp.json();
    if (!meResp.ok || !me?.id) {
      return NextResponse.json({ error: 'Invalid Kakao token', raw: me }, { status: 401 });
    }

    const kakaoId = String(me.id);
    const uid = `kakao:${kakaoId}`;

    const nickname =
      me?.kakao_account?.profile?.nickname ??
      me?.properties?.nickname ??
      `UNI-${kakaoId.slice(-4)}`;

    const profileImage =
      me?.kakao_account?.profile?.profile_image_url ??
      me?.properties?.profile_image ??
      '';

    const customToken = await adminAuth.createCustomToken(uid, {
      provider: 'kakao',
      name: nickname || '',
      profileImage: profileImage || '',
    });

    const userRef = adminDb.collection('users').doc(uid);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const prev = snap.exists ? (snap.data() as any) : {};

      const finalName =
        prev?.name && String(prev.name).trim() ? prev.name : nickname;
      const finalProfile = profileImage || prev?.profileImage || '';

      tx.set(
        userRef,
        {
          uid,
          provider: 'kakao',
          name: finalName,
          profileImage: finalProfile,
          kakaoAppUserId: kakaoId,              // ✅ 추가: 카카오 사용자 ID 저장
          lastKakaoSyncAt: new Date(),
          createdAt: prev?.createdAt || new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ customToken });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
