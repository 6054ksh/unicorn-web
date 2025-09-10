// src/app/api/kakao/skill/link-account/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

function nano(min = 6) {
  const s = Math.random().toString(36).slice(2);
  return s.slice(0, Math.max(min, 6));
}

export async function POST(req: Request) {
  try {
    const db = getAdminDb();
    const body = await req.json().catch(() => ({}));
    const appUserId: string | undefined = body?.userRequest?.user?.id;

    if (!appUserId) {
      // 카카오 스킬 포맷으로 에러 리턴
      return NextResponse.json({
        version: '2.0',
        template: { outputs: [{ simpleText: { text: '연동 정보를 가져오지 못했어요. 다시 시도해 주세요.' } }] }
      });
    }

    const code = nano(8);
    const now = Date.now();
    // 15분 TTL
    await db.collection('kakao_link_tokens').doc(code).set({
      appUserId,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
    });

    const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const link = `${base}/kakao/link?code=${encodeURIComponent(code)}`;

    // 카카오 스킬 응답 포맷
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: '👇 아래 버튼을 눌러 웹에서 로그인 후 연동을 완료해 주세요.',
            }
          }
        ],
        quickReplies: [
          {
            label: '연동하기',
            action: 'webLink',
            webLinkUrl: link
          }
        ]
      }
    });
  } catch (e: any) {
    return NextResponse.json({
      version: '2.0',
      template: { outputs: [{ simpleText: { text: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' } }] }
    });
  }
}
