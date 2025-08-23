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
  revealAt?: string;
  closed?: boolean;
  participantsCount?: number;
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

async function getBaseUrlServer(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
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
  const res = await fetch(`${base}/api/rooms/get?id=${encodeURIComponent(id)}`, { cache: 'no-store', next: { revalidate: 0 } as any });
  if (!res.ok) { if (res.status === 404) return null; throw new Error(`detail fetch failed: ${res.status}`); }
  const j = await res.json();
  return j.room as Room;
}

export default async function RoomDetailPage(props: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const raw = (props as any).params;
  const { id } = typeof raw?.then === 'function' ? await raw : raw;

  const room = await fetchRoomOnServer(id);
  if (!room) notFound();

  const start = new Date(room.startAt).getTime();
  const end = new Date(room.endAt).getTime();
  const now = Date.now();
  const started = now >= start;
  const ended = now >= end || !!room.closed;
  const state = ended ? '종료' : started ? '진행중' : '모집중';

  const human = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const capacity = Number(room.capacity || 0);
  const joined = Number(room.participantsCount || 0);
  const pct = capacity ? Math.min(100, Math.round((joined / capacity) * 100)) : 0;

  const ClientButtons = (await import('./ClientButtons')).default;

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <h1 style={{ margin:0 }}>{room.title}</h1>
        <span style={{
          fontSize:12, padding:'4px 10px', borderRadius:999, border:'1px solid #ddd',
          background: ended ? '#f3f4f6' : started ? '#e6f4ea' : '#eef2ff',
          color: ended ? '#374151' : started ? '#166534' : '#3730a3'
        }}>
          {state}
        </span>
      </div>

      <div style={{ marginTop:12, border:'1px solid #eee', borderRadius:12, background:'#fff' }}>
        <div style={{ padding:16, display:'grid', gap:8 }}>
          <div style={{ color:'#444' }}>
            <div>장소: {room.location}</div>
            <div>시간: {human(room.startAt)} ~ {human(room.endAt)}</div>
            {room.type ? <div>종류: {room.type}</div> : null}
            {room.content ? <div>내용: {room.content}</div> : null}
            {room.kakaoOpenChatUrl ? (
              <div>오픈채팅: <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{room.kakaoOpenChatUrl}</a></div>
            ) : null}
          </div>

          <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#666' }}>
              <span>정원 {capacity}명</span>
              <span>참여 {joined}명</span>
            </div>
            <div style={{ marginTop:6, height:10, background:'#f2f3f5', borderRadius:999 }}>
              <div style={{
                width:`${pct}%`, height:'100%', background: joined >= capacity ? '#ef4444' : '#3b82f6',
                borderRadius:999, transition:'width .3s ease'
              }}/>
            </div>
          </div>

          <div style={{ marginTop:4 }}>
            <ClientButtons
              roomId={room.id}
              closed={!!room.closed}
              startAt={room.startAt}
              endAt={room.endAt}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop:16, display:'flex', gap:8 }}>
        <a href="/room" style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none', color:'#111' }}>목록으로</a>
        <a href="/room/new" style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none', color:'#111' }}>방 만들기</a>
      </div>
    </main>
  );
}
