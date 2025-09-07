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
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
  participants?: string[];
  participantsCount?: number;
  voteOpen?: boolean;
  voteDoneUids?: string[];
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
  const res = await fetch(`${base}/api/rooms/get?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('failed');
  }
  const j = await res.json();
  return j.room as Room;
}

export default async function RoomDetailPage(props: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const raw = (props as any).params;
  const { id } = typeof raw?.then === 'function' ? await raw : raw;

  const room = await fetchRoomOnServer(id);
  if (!room) notFound();

  const Client = (await import('./ClientButtons')).default;

  const human = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d as any)) return iso;
    return d.toLocaleString();
  };

  const now = Date.now();
  const started = now >= new Date(room.startAt).getTime();
  const ended = now >= new Date(room.endAt).getTime();
  const canReveal = room.revealAt ? now >= new Date(room.revealAt).getTime() : started;

  return (
    <main style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <div style={{
        border: '1px solid #e9e9ec', borderRadius: 16, padding: 18, background: '#fff',
        boxShadow: '0 6px 16px rgba(0,0,0,.04)'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12 }}>
          <h1 style={{ margin:0, fontSize: 22 }}>{room.title}</h1>
          <span style={{
            fontSize: 12, padding:'2px 8px', borderRadius:999, border:'1px solid #ddd',
            background: ended ? '#f3f4f6' : started ? '#e6f4ea' : '#eef2ff',
            color: ended ? '#374151' : started ? '#166534' : '#3730a3'
          }}>
            {ended ? '종료' : started ? '진행중' : '모집중'}
          </span>
        </div>

        <div style={{ color:'#555', fontSize:14, marginTop:6 }}>
          <div>장소: {room.location}</div>
          <div>시간: {human(room.startAt)} ~ {human(room.endAt)}</div>
          {room.type ? <div>종류: {room.type}</div> : null}
          {room.content ? <div>내용: {room.content}</div> : null}
          {room.kakaoOpenChatUrl ? (
            <div>오픈채팅: <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{room.kakaoOpenChatUrl}</a></div>
          ) : null}
        </div>

        {/* 액션 바 (참여/나가기, 내 참여 여부 따라 버튼 활성화) */}
        <div style={{ marginTop: 12 }}>
          <Client
            roomId={room.id}
            startAt={room.startAt}
            endAt={room.endAt}
            closed={!!room.closed}
          />
        </div>

        {/* 참가자 공개(리빌) */}
        <div style={{ marginTop: 16, borderTop:'1px dashed #eee', paddingTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>모임 구성원</div>
          {!canReveal ? (
            <div style={{ color:'#666', fontSize:13 }}>
              구성원은 공개 시각(시작 1시간 전)부터 볼 수 있어요. <br />
              공개 예정: {room.revealAt ? human(room.revealAt) : '(시작 1시간 전)'}
            </div>
          ) : (
            <Participants roomId={room.id} />
          )}
        </div>

        {/* 종료 이후 투표 패널 (24h 동안) */}
        {ended ? (
          <div style={{ marginTop: 16, borderTop:'1px dashed #eee', paddingTop: 12 }}>
            <VotePanel roomId={room.id} participants={(room.participants || []).slice()} />
          </div>
        ) : null}
      </div>
    </main>
  );
}

// 클라이언트 서브컴포넌트들
function Participants(_props: { roomId: string }) {
  // 심플 표기(필요시 Firestore에서 상세 메타 로드하도록 확장 가능)
  return <div style={{ color:'#666', fontSize:13 }}>참가자 목록은 홈의 내 모임 카드에서 프로필 이름으로 확인할 수 있어요.</div>;
}

function VotePanel(_props: { roomId: string; participants: string[] }) {
  // 홈/메인에 이미 상세 투표가 있어요. 여기선 안내만 간결히 유지(중복기능 유지).
  return <div style={{ color:'#333', fontSize:13 }}>투표는 홈의 “내 모임” 섹션 또는 상단 좌측의 🔔알림 패널에서 바로 진행할 수 있어요.</div>;
}
