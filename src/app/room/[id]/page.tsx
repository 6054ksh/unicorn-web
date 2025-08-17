// Server Component
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import ClientButtons from './ClientButtons';

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
  // 절대 URL 생성(개발/배포 모두 안정)
  const h = headers();
  const host = h.get('host')!;
  const proto = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const url = `${proto}://${host}/api/rooms/get?id=${encodeURIComponent(id)}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) return null;
    let body: any = {};
    try { body = await res.json(); } catch {}
    throw new Error(`detail fetch failed: ${res.status} ${JSON.stringify(body)}`);
  }
  const j = await res.json();
  return j.room as Room;
}

export default async function RoomDetailPage({ params }: { params: { id: string } }) {
  const room = await fetchRoomOnServer(params.id);
  if (!room) notFound();

  const human = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

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
        {room.type ? <><br/>종류: {room.type}</> : null}
        {room.content ? <><br/>내용: {room.content}</> : null}
      </div>

      {/* 클라이언트 컴포넌트로 분리 */}
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
