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
  minCapacity?: number;
  startAt: string;
  endAt: string;
  revealAt?: string;
  closed?: boolean;
  votingOpen?: boolean;
  abortedUnderMin?: boolean;
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
  // Next.js 15에서 params가 Promise일 수 있어 두 케이스 모두 안전 처리
  const raw = (props as any).params;
  const { id } = typeof raw?.then === 'function' ? await raw : raw;

  const room = await fetchRoom(id);
  if (!room) notFound();

  // 상세 UI/상태(투표중 전환, 최소인원 미달 즉시 종료, 투표 UI 등)는
  // Client 컴포넌트에서 처리 (중복 방지 및 유지보수성 향상)
  const Client = (await import('./Client')).default;

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Client room={room} />
    </main>
  );
}
