export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const appUserId = body?.userRequest?.user?.id; // ← 오픈빌더가 보내주는 사용자 ID
    const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const linkUrl = appUserId && base ? `${base}/kakao/link?au=${encodeURIComponent(appUserId)}` : '';

    if (!appUserId || !linkUrl) {
      return NextResponse.json({
        version: '2.0',
        template: { outputs: [{ simpleText: { text: '연결에 필요한 정보가 부족합니다. 관리자에게 문의해주세요.' } }] }
      });
    }

    // 카카오 스킬 응답 포맷
    return NextResponse.json({
      version: '2.0',
      template: {
        outputs: [{
          basicCard: {
            title: 'UNIcorn 계정 연결',
            description: '아래 버튼을 눌러 웹에서 로그인하면 연결됩니다.',
            buttons: [{ action: 'webLink', label: '계정 연결하기', webLinkUrl: linkUrl }]
          }
        }]
      }
    });
  } catch {
    return NextResponse.json({
      version: '2.0',
      template: { outputs: [{ simpleText: { text: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' } }] }
    });
  }
}
