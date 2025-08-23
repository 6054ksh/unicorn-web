// src/app/room/[id]/page.tsx
import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string;
  endAt: string;
  joinLockUntil?: string;
  revealAt?: string;
  closed?: boolean;
  participantsCount?: number;
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

// ✅ headers()가 Promise로 타입된 환경에서도 안전하게 동작하도록 async/await 적용
async function getBaseUrlServer(): Promise<string> {
  // 1) 우리가 고정한 BASE_URL 우선
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  // 2) Vercel에서 제공
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // 3) 요청 헤더로 복구
  try {
    const h = await headers(); // ← 여기!
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('host');
    if (host) return `${proto}://${host}`;
  } catch {
    // ignore
  }
  // 4) 로컬 폴백
  return 'http://localhost:3000';
}

async function fetchRoomOnServer(id: string): Promise<Room | null> {
  const base = await getBaseUrlServer(); // ← 호출부도 await
  const url = `${base}/api/rooms/get?id=${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    cache: 'no-store',
    //// @ts-expect-error: next 옵션 쓰는 경우 타입 경고 무시
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    let body: unknown = {};
    try {
      body = await res.json();
    } catch {}
    throw new Error(`detail fetch failed: ${res.status} ${JSON.stringify(body)}`);
  }

  const j = await res.json();
  return j.room as Room;
}

export default async function RoomDetailPage(
  props:
    | { params: { id: string } }
    | { params: Promise<{ id: string }> }
) {
  // Next 버전별 params 타입 차이 방어
  const raw = (props as any).params;
  const { id } = typeof raw?.then === 'function' ? await raw : raw;

  const room = await fetchRoomOnServer(id);
  if (!room) notFound();

  const human = (iso?: string) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const ClientButtons = (await import('./ClientButtons')).default;

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>{room.title}</h1>
      <div style={{ color: '#666', marginBottom: 16 }}>
        장소: {room.location} · 정원: {room.capacity}명 · 참여: {room.participantsCount ?? 0}명
        <br />
        시작: {human(room.startAt)} / 종료: {human(room.endAt)}
        {room.kakaoOpenChatUrl ? (
          <>
            <br />
            오픈채팅:{' '}
            <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">
              {room.kakaoOpenChatUrl}
            </a>
          </>
        ) : null}
        {room.type ? (
          <>
            <br />
            종류: {room.type}
          </>
        ) : null}
        {room.content ? (
          <>
            <br />
            내용: {room.content}
          </>
        ) : null}
      </div>

      <ClientButtons
        roomId={room.id}
        closed={!!room.closed}
        startAt={room.startAt}
        endAt={room.endAt}
        joinLockUntil={room.joinLockUntil}
      />
    </main>
  );
}
