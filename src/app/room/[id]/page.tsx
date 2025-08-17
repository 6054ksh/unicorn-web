// src/app/room/[id]/page.tsx
// Server Component
import { notFound } from 'next/navigation';

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

async function fetchRoomOnServer(id: string): Promise<Room | null> {
  const res = await fetch(`/api/rooms/get?id=${encodeURIComponent(id)}`, {
    cache: 'no-store',
    // next: { revalidate: 0 } // 원하면 명시
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

export default async function RoomDetailPage({
  params,
}: {
  // ✅ Next 15: params는 Promise
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // ClientButtons는 그대로 사용하세요 (파일 위치: src/app/room/[id]/ClientButtons.tsx)
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
