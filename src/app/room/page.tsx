'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string;
  endAt: string;
  closed?: boolean;
  participantsCount?: number;
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetchOpen = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/rooms/list?status=open&limit=100', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) {
        setErr(j?.error || 'unknown error');
        setRooms([]);
      } else {
        setRooms(j.rooms || []);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpen();
  }, []);

  const human = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>모임 방 목록 (종료 숨김)</h1>
      {loading && <p>불러오는 중…</p>}
      {err && <p style={{ color: 'crimson' }}>❌ {err}</p>}
      {!loading && !err && rooms.length === 0 && <p>표시할 방이 없습니다.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {rooms.map((r) => (
          <a key={r.id} href={`/room/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{r.title}</div>
              <div style={{ color: '#555', fontSize: 13 }}>
                장소: {r.location} · 정원: {r.capacity}명 · 참여: {r.participantsCount ?? 0}명
              </div>
              <div style={{ color: '#666', fontSize: 12 }}>
                시작: {human(r.startAt)} / 종료 예정: {human(r.endAt)}
              </div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
