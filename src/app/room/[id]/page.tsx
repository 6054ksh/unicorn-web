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
  endAt?: string;
  revealAt?: string;
  closed?: boolean;
  participantsCount?: number;
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

const kstFmt = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

function humanKST(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return kstFmt.format(d);
}

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
  const res = await fetch(`${base}/api/rooms/get?id=${encodeURIComponent(id)}`, {
    cache: 'no-store',

  });
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

  // 공개 시각 계산 (문서에 없다면 startAt - 1h)
  const revealAt = room.revealAt
    ? new Date(room.revealAt)
    : new Date(new Date(room.startAt).getTime() - 60 * 60 * 1000);

  // 종료시각이 비어있으면 화면 표시에만 +5h (서버 생성 로직에서도 설정하는 걸 권장)
  const endAtShow =
    room.endAt && !Number.isNaN(new Date(room.endAt).getTime())
      ? room.endAt
      : new Date(new Date(room.startAt).getTime() + 5 * 60 * 60 * 1000).toISOString();

  const ClientButtons = (await import('./ClientButtons')).default;
  const ParticipantsBox = (await import('./ParticipantsBox')).default;

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>{room.title}</h1>

      <div style={{ display: 'grid', gap: 8, border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
        <div style={{ color: '#444' }}>
          <b>장소</b>: {room.location} &nbsp; · &nbsp; <b>정원</b>: {room.capacity}명 &nbsp; · &nbsp;
          <b>참여</b>: {room.participantsCount ?? 0}명
        </div>
        <div style={{ color: '#555', fontSize: 14 }}>
          <div>⏰ 시작: {humanKST(room.startAt)} &nbsp; / &nbsp; 종료: {humanKST(endAtShow)}</div>
          <div>🙈 참여자 공개: {humanKST(revealAt.toISOString())} (시작 1시간 전)</div>
        </div>
        {room.kakaoOpenChatUrl ? (
          <div style={{ color: '#444' }}>
            🔗 오픈채팅:&nbsp;
            <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{room.kakaoOpenChatUrl}</a>
          </div>
        ) : null}
        {room.type ? <div style={{ color: '#444' }}>📌 종류: {room.type}</div> : null}
        {room.content ? <div style={{ color: '#444' }}>📝 내용: {room.content}</div> : null}
      </div>

      <div style={{ marginTop: 12 }}>
        <ClientButtons
          roomId={room.id}
          closed={!!room.closed}
          startAt={room.startAt}
          endAt={endAtShow}
          // joinLockUntil는 정책상 사용 안함
        />
      </div>

      {/* 참여자 박스 */}
      <ParticipantsBox roomId={room.id} capacity={room.capacity} />
    </main>
  );
}
