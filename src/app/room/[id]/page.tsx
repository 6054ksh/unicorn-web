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
  revealAt?: string;
  closed?: boolean;
  participantsCount?: number;
  participants?: string[]; // ✅ 추가
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

async function getBaseUrlServer(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('host');
    if (host) return `${proto}://${host}`;
  } catch {}
  return 'http://localhost:3000';
}

async function fetchRoomOnServer(id: string): Promise<Room | null> {
  const base = await getBaseUrlServer();
  const url = `${base}/api/rooms/get?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    if (res.status === 404) return null;
    let body: unknown = {};
    try { body = await res.json(); } catch {}
    throw new Error(`detail fetch failed: ${res.status} ${JSON.stringify(body)}`);
  }

  const j = await res.json();
  return j.room as Room;
}

export default async function RoomDetailPage(
  props: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const raw = (props as any).params;
  const { id } = typeof raw?.then === 'function' ? await raw : raw;

  const room = await fetchRoomOnServer(id);
  if (!room) notFound();

  const human = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const ClientButtons = (await import('./ClientButtons')).default;

  return (
    <main style={{ padding: 24, maxWidth: 840, margin: '0 auto' }}>
      <div style={{ display:'grid', gap:8 }}>
        <h1 style={{ margin: 0 }}>{room.title}</h1>
        <div style={{ color: '#666' }}>
          장소: {room.location} · 정원: {room.capacity}명 · 참여: {room.participantsCount ?? 0}명
          <br />
          시간: {human(room.startAt)} ~ {human(room.endAt)}
          {room.type ? <><br/>종류: {room.type}</> : null}
          {room.content ? <><br/>내용: {room.content}</> : null}
          {room.kakaoOpenChatUrl ? (
            <>
              <br />
              오픈채팅: <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{room.kakaoOpenChatUrl}</a>
            </>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <ClientButtons
          roomId={room.id}
          closed={!!room.closed}
          startAt={room.startAt}
          endAt={room.endAt}
          participants={room.participants || []}
        />
      </div>
    </main>
  );
}
