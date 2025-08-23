// src/app/admin/rooms/page.tsx
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
  const [status, setStatus] = useState<StatusFilter>('open');
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
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>관리자 · {header}</h1>

      {/* 상태 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['open','closed','all'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '8px 12px',
              background: status === s ? '#111' : '#fff',
              color: status === s ? '#fff' : '#111',
              border:'1px solid #ddd',
              borderRadius: 10,
              cursor:'pointer'
            }}
          >
            {s==='open'?'진행/예정':'closed'===s?'종료됨만':'전체'}
          </button>
        ))}
      </div>

      {loading && <p>불러오는 중…</p>}
      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}
      {!loading && !error && rooms.length === 0 && <p>표시할 방이 없습니다.</p>}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {rooms.map((r) => {
          const full = Number(r.capacity || 0) > 0 && (r.participantsCount || 0) >= Number(r.capacity || 0);
          return (
            <div key={r.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 14, background:'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, display:'flex', gap:8, alignItems:'center' }}>
                    {r.title}
                    {r.closed ? <span style={pillDanger}>종료</span> : <span style={pill}>{full?'정원만석':'모집중'}</span>}
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
                    <button onClick={() => onForceClose(r.id)} style={btnDanger} title="즉시 종료(강제)">강제 종료</button>
                  )}
                  <a href={`/room/${r.id}`} target="_blank" rel="noreferrer" style={btnPrimaryLink}>상세 보기</a>
                </div>
              </div>

              {(r.type || r.content || r.kakaoOpenChatUrl) && (
                <div style={{ marginTop: 8, color: '#333', fontSize: 13 }}>
                  {r.type && <div>종류: {r.type}</div>}
                  {r.content && <div>내용: {r.content}</div>}
                  {r.kakaoOpenChatUrl && (
                    <div>오픈채팅: <a href={r.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{r.kakaoOpenChatUrl}</a></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

const pill: React.CSSProperties = { fontSize:12, padding:'2px 8px', borderRadius:999, border:'1px solid #e5e7eb', background:'#eef2ff', color:'#3730a3' };
const pillDanger: React.CSSProperties = { ...pill, background:'#fef2f2', color:'#991b1b', borderColor:'#fecaca' };
const btnDanger: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #b91c1c', background:'#b91c1c', color:'#fff', cursor:'pointer' };
const btnPrimaryLink: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #111', background:'#111', color:'#fff', textDecoration:'none' };
