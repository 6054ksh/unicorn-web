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
  minCapacity: number;
  startAt: string;
  endAt?: string;
  revealAt?: string;
  closed?: boolean;
  participantsCount?: number;
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

async function getBaseUrlServer(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const host = h.get('host');
    if (host) return `${proto}://${host}`;
  } catch {}
  return 'http://localhost:3000';
}

function calcEndIso(r: Room): string {
  const start = new Date(r.startAt);
  const end = r.endAt ? new Date(r.endAt) : new Date(start.getTime() + 5 * 60 * 60 * 1000);
  return end.toISOString();
}

async function fetchRoomOnServer(id: string): Promise<Room | null> {
  const base = await getBaseUrlServer();
  const res = await fetch(`${base}/api/rooms/get?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
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
  props:
    | { params: { id: string } }
    | { params: Promise<{ id: string }> }
) {
  const raw = (props as any).params;
  const { id } = typeof raw?.then === 'function' ? await raw : raw;

  const room = await fetchRoomOnServer(id);
  if (!room) notFound();

  const human = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const endIso = calcEndIso(room);
  const ClientButtons = (await import('./ClientButtons')).default;

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>{room.title}</h1>
      <div style={{ color: '#666', marginBottom: 16 }}>
        장소: {room.location}
        <br />
        정원: 최대 {room.capacity}명 / 최소 {room.minCapacity}명 · 현재 참여: {room.participantsCount ?? 0}명
        <br />
        시간: {human(room.startAt)} ~ {human(endIso)}
        {room.kakaoOpenChatUrl ? (
          <>
            <br />
            오픈채팅:{' '}
            <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">
              {room.kakaoOpenChatUrl}
            </a>
          </>
        ) : null}
        {room.type ? (<><br />종류: {room.type}</>) : null}
        {room.content ? (<><br />내용: {room.content}</>) : null}
        <br />
        <small style={{ color:'#999' }}>
          ※ 최소 정원 미달 시 시작 시간에 자동 취소됩니다.
        </small>
      </div>

      <ClientButtons
        roomId={room.id}
        closed={!!room.closed}
        startAt={room.startAt}
        endAt={endIso}
        joinLockUntil={undefined}
      />
    </main>
  );
}
