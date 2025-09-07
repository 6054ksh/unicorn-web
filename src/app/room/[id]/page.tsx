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
  participants?: string[];
  type?: string;
  content?: string;
  kakaoOpenChatUrl?: string;
};

async function getBaseUrl(): Promise<string> {
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

async function fetchRoom(id: string): Promise<Room | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/rooms/get?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) return res.status === 404 ? null : Promise.reject(await res.text());
  const j = await res.json();
  return j.room as Room;
}

export default async function RoomDetailPage(
  props: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const raw = (props as any).params;
  const { id } = typeof raw?.then === 'function' ? await raw : raw;

  const room = await fetchRoom(id);
  if (!room) notFound();

  const human = (iso?: string) => { try { return iso ? new Date(iso).toLocaleString() : '-'; } catch { return iso||'-'; } };

  const ClientButtons = (await import('./ClientButtons')).default;

  const pct = room.capacity ? Math.min(100, Math.round(((room.participantsCount||0) / room.capacity) * 100)) : 0;

  return (
    <main style={{ padding: 24, maxWidth: 920, margin: '0 auto' }}>
      <div style={{
        border:'2px solid #c7d2fe',
        background:'#eef2ff',
        borderRadius:16, padding:16, boxShadow:'0 8px 24px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <h1 style={{ margin:0, fontSize:22 }}>{room.title}</h1>
          <span style={{
            fontSize:12, padding:'2px 8px', borderRadius:999,
            border:'1px solid #ddd', background: room.closed ? '#f3f4f6' : '#e6f4ea',
            color: room.closed ? '#374151' : '#166534'
          }}>
            {room.closed ? '종료됨' : '진행/예정'}
          </span>
        </div>

        <div style={{ color:'#444', marginTop:8, lineHeight:1.6 }}>
          <div>장소: <b>{room.location}</b></div>
          <div>시간: <b>{human(room.startAt)}</b> ~ <b>{human(room.endAt)}</b></div>
          {room.type ? <div>종류: {room.type}</div> : null}
          {room.content ? <div>내용: {room.content}</div> : null}
          {room.kakaoOpenChatUrl ? (
            <div>
              오픈채팅: <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{room.kakaoOpenChatUrl}</a>
            </div>
          ) : null}
        </div>

        {/* 진행도 바 */}
        <div style={{ marginTop:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#666' }}>
            <span>정원 {room.capacity ?? 0}명</span>
            <span>참여 {room.participantsCount ?? 0}명</span>
          </div>
          <div style={{ marginTop:6, height:10, background:'#e5e7eb', borderRadius:999 }}>
            <div style={{
              width: `${pct}%`,
              height:'100%',
              background: pct >= 100 ? '#ef4444' : '#3b82f6',
              borderRadius:999,
              transition:'width .3s ease'
            }}/>
          </div>
        </div>

        <div style={{ marginTop:14 }}>
          <ClientButtons
            roomId={room.id}
            closed={!!room.closed}
            startAt={room.startAt}
            endAt={room.endAt}
            participants={room.participants || []}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <a href="/" style={{ textDecoration:'none', color:'#111', fontWeight:700 }}>← 홈으로</a>
      </div>
    </main>
  );
}
