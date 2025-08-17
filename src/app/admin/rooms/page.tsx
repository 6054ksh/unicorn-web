'use client';

import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string; // ISO
  endAt: string;   // ISO
  revealAt?: string;
  joinLockUntil?: string;
  creatorUid: string;
  closed?: boolean;
  participants?: string[];
  participantsCount?: number;
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

type StatusFilter = 'open' | 'closed' | 'all';

export default function AdminRoomsPage() {
  const [status, setStatus] = useState<StatusFilter>('open'); // 기본 'open' = 종료 숨김
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string>('');

  const fetchList = async (s: StatusFilter) => {
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch(`/api/admin/rooms/list?status=${s}&limit=100`);
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || 'unknown error');
        setRooms([]);
      } else {
        setRooms(j.rooms || []);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const onForceClose = async (roomId: string) => {
    if (!confirm('해당 방을 지금 즉시 종료할까요?')) return;
    try {
      const res = await authedFetch('/api/admin/rooms/close', {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert('종료 실패: ' + (j?.error || 'unknown'));
        return;
      }
      // 현재 필터가 open이면, 종료된 방은 리스트에서 자동으로 사라져야 하므로 재조회
      await fetchList(status);
    } catch (e: any) {
      alert('종료 실패: ' + (e?.message ?? String(e)));
    }
  };

  const humanTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return `${d.toLocaleString()}`;
    } catch {
      return iso;
    }
  };

  const header = useMemo(() => {
    if (status === 'open') return '모임 리스트(진행/예정) - 종료 숨김';
    if (status === 'closed') return '모임 리스트(종료됨만)';
    return '모임 리스트(전체)';
  }, [status]);

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>관리자 · {header}</h1>

      {/* 상태 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setStatus('open')}
          style={{ padding: '6px 10px', background: status === 'open' ? '#333' : '#eee', color: status === 'open' ? '#fff' : '#000', borderRadius: 8 }}
        >
          진행/예정(종료 숨김)
        </button>
        <button
          onClick={() => setStatus('closed')}
          style={{ padding: '6px 10px', background: status === 'closed' ? '#333' : '#eee', color: status === 'closed' ? '#fff' : '#000', borderRadius: 8 }}
        >
          종료됨만
        </button>
        <button
          onClick={() => setStatus('all')}
          style={{ padding: '6px 10px', background: status === 'all' ? '#333' : '#eee', color: status === 'all' ? '#fff' : '#000', borderRadius: 8 }}
        >
          전체
        </button>
      </div>

      {loading && <p>불러오는 중…</p>}
      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}

      {!loading && !error && rooms.length === 0 && <p>표시할 방이 없습니다.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {rooms.map((r) => (
          <div key={r.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {r.title} {r.closed ? <span style={{ color: 'crimson', fontWeight: 600 }}>(종료)</span> : null}
                </div>
                <div style={{ color: '#555', fontSize: 13 }}>
                  장소: {r.location} · 정원: {r.capacity}명 · 참여: {r.participantsCount ?? (r.participants?.length ?? 0)}명
                </div>
                <div style={{ color: '#666', fontSize: 12 }}>
                  시작: {humanTime(r.startAt)} / 종료: {humanTime(r.endAt)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!r.closed && (
                  <button
                    onClick={() => onForceClose(r.id)}
                    style={{ padding: '6px 10px', background: '#c62828', color: '#fff', borderRadius: 8 }}
                    title="즉시 종료(강제)"
                  >
                    강제 종료
                  </button>
                )}
                <a
                  href={`/room/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: '6px 10px', background: '#1976d2', color: '#fff', borderRadius: 8, textDecoration: 'none' }}
                >
                  상세 보기
                </a>
              </div>
            </div>

            {r.type || r.content || r.kakaoOpenChatUrl ? (
              <div style={{ marginTop: 8, color: '#333', fontSize: 13 }}>
                {r.type && <div>종류: {r.type}</div>}
                {r.content && <div>내용: {r.content}</div>}
                {r.kakaoOpenChatUrl && (
                  <div>
                    오픈채팅: <a href={r.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{r.kakaoOpenChatUrl}</a>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
