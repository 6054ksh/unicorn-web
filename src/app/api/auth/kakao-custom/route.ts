export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// 클라이언트 콜백(page.tsx 등)에서 accessToken을 보내면 이 라우트가 커스텀 토큰 발급
export async function POST(req: Request) {
  try {
    const { accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken required' }, { status: 400 });
    }

    // 1) 카카오 사용자 정보 조회
    const meResp = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = await meResp.json();
    if (!meResp.ok || !me?.id) {
      return NextResponse.json({ error: 'Invalid Kakao token', raw: me }, { status: 401 });
    }

    const kakaoId = String(me.id);
    const uid = `kakao:${kakaoId}`;

    // 동의된 항목만 값이 옵니다. (미동의면 빈 값일 수 있음)
    const nickname =
      me?.kakao_account?.profile?.nickname ??
      me?.properties?.nickname ??
      `UNI-${kakaoId.slice(-4)}`;

    const profileImage =
      me?.kakao_account?.profile?.profile_image_url ??
      me?.properties?.profile_image ??
      '';

    // 2) 커스텀 토큰 발급
    const customToken = await adminAuth.createCustomToken(uid, {
      provider: 'kakao',
      name: nickname || '',
      profileImage: profileImage || '',
    });

    // 3) users/{uid} upsert (기존 name이 있으면 보존)
    const userRef = adminDb.collection('users').doc(uid);
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const prev = snap.exists ? (snap.data() as any) : {};

      const finalName =
        prev?.name && String(prev.name).trim()
          ? prev.name
          : nickname;

      const finalProfile =
        profileImage || prev?.profileImage || '';

      tx.set(
        userRef,
        {
          uid,
          provider: 'kakao',
          name: finalName,
          profileImage: finalProfile,
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
