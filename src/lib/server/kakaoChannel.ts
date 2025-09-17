// 예시: src/lib/server/kakaoChannel.ts (네 프로젝트 경로에 맞게)
import { getAdminDb } from '@/lib/firebaseAdmin';

type Target = { id: string; idType: 'appUserId' | 'userPhone' }; // 실제 사양과 맞추세요.

export type KakaoEventUser = {
  idType: 'appUserId'; // 필요하면 'phone' | 'userId' 추가
  id: string;
};
export async function callKakaoChannelAPI(
  event: 'room_created' | string,
  targets: KakaoEventUser[],
  payload: Record<string, any>
) {
  const BOT_ID = process.env.KAKAO_BOT_ID!;
  const BOT_API_KEY = process.env.KAKAO_BOT_API_KEY!;

  const body = {
    botId: BOT_ID,
    event,
    targets,
    payload,
  };

  let ok = false;
  let resp: any = null;
  let err: any = null;

  try {
    const r = await fetch(process.env.KAKAO_EVENT_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 실제 카카오 iOB 이벤트 엔드포인트 스펙에 맞춰 Authorization 등 헤더 구성
        Authorization: `KakaoAK ${BOT_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    resp = await r.json().catch(() => ({}));
    ok = r.ok;
  } catch (e: any) {
    err = e;
  }

  // Firestore 로깅(선택)
  try {
    const db = getAdminDb();
    await db.collection('kakaoEventLogs').add({
      at: new Date().toISOString(),
      event,
      targets,
      payload,
      ok,
      resp,
      error: err ? String(err?.message ?? err) : null,
    });
  } catch {}

  if (!ok) {
    throw new Error(resp?.message || err?.message || 'kakao event failed');
  }
  return resp;
}
