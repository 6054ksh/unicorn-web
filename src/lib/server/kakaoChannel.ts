import 'server-only';

export type KakaoEventUser = {
  idType: 'appUserId' | 'botUserKey' | 'plusfriendUserKey';
  id: string;
};

export async function callKakaoChannelAPI(
  eventName: string,
  users: KakaoEventUser[],
  params?: Record<string, any>
) {
  const botId = process.env.KAKAO_BOT_ID;
  const adminKey = process.env.KAKAO_ADMIN_KEY; // ✅ 디벨로퍼스 Admin Key

  if (!botId || !adminKey) throw new Error('Missing KAKAO_BOT_ID or KAKAO_ADMIN_KEY');
  if (!users?.length) return { ok: true, skipped: 'no-users' };

  const payload = {
    event: { name: eventName },
    user: users.map(u => ({ id: u.id, type: u.idType })),
    ...(params ? { params } : {})
  };

  const res = await fetch(`https://bot-api.kakao.com/v2/bots/${encodeURIComponent(botId)}/talk`, {
    method: 'POST',
    headers: {
      Authorization: `KakaoAK ${adminKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Kakao Event API ${res.status} ${res.statusText}: ${text}`);
  try { return JSON.parse(text); } catch { return { ok: true }; }
}
