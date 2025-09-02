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

  const onDelete = async (roomId: string) => {
    if (!confirm('정말 삭제할까요? (보관본 저장 후 삭제됩니다)')) return;
    try {
      const res = await authedFetch('/api/admin/rooms/delete', {
        method: 'POST',
        body: JSON.stringify({ roomId, archive: true }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert('삭제 실패: ' + (j?.error || 'unknown'));
        return;
      }
      await fetchList(status);
    } catch (e: any) {
      alert('삭제 실패: ' + (e?.message ?? String(e)));
    }
  };

  const humanTime = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const header = useMemo(() => {
    if (status === 'open') return '모임 리스트(진행/예정) - 종료 숨김';
    if (status === 'closed') return '모임 리스트(종료됨만)';
    return '모임 리스트(전체)';
  }, [status]);

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto', background:'#fafbfd' }}>
      <h1 style={{ marginBottom: 16 }}>관리자 · {header}</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['open','closed','all'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '8px 12px',
              background: status === s ? '#2563eb' : '#eef2ff',
              color: status === s ? '#fff' : '#1e293b',
              borderRadius: 10,
              border: '1px solid #dbeafe',
              fontWeight: 600
            }}
          >
            {s === 'open' ? '진행/예정' : s === 'closed' ? '종료됨' : '전체'}
          </button>
        ))}
      </div>

      {loading && <p>불러오는 중…</p>}
      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}
      {!loading && !error && rooms.length === 0 && <p>표시할 방이 없습니다.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {rooms.map((r) => {
          const isFull = (r.participantsCount ?? r.participants?.length ?? 0) >= (r.capacity ?? 0);
          return (
            <div key={r.id} style={{ border: '1px solid #e6ebf3', borderRadius: 14, padding: 14, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                    {r.title} {r.closed ? <span style={{ color: '#dc2626', fontWeight: 700 }}>(종료)</span> : null}
                  </div>
                  <div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
                    장소: {r.location} · 정원: {r.capacity}명 · 참여: {r.participantsCount ?? (r.participants?.length ?? 0)}명 {isFull ? '· 정원마감' : ''}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    시작: {humanTime(r.startAt)} / 종료: {humanTime(r.endAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {!r.closed && (
                    <button
                      onClick={() => onForceClose(r.id)}
                      style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', borderRadius: 8 }}
                      title="즉시 종료(강제)"
                    >
                      강제 종료
                    </button>
                  )}
                  <a
                    href={`/room/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '6px 10px', background: '#2563eb', color: '#fff', borderRadius: 8, textDecoration: 'none' }}
                  >
                    상세 보기
                  </a>
                  <button
                    onClick={() => onDelete(r.id)}
                    style={{ padding: '6px 10px', background: '#f1f5f9', color: '#0f172a', borderRadius: 8, border:'1px solid #e2e8f0' }}
                    title="보관 후 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {(r.type || r.content || r.kakaoOpenChatUrl) && (
                <div style={{ marginTop: 8, color: '#334155', fontSize: 13 }}>
                  {r.type && <div>종류: {r.type}</div>}
                  {r.content && <div>내용: {r.content}</div>}
                  {r.kakaoOpenChatUrl && (
                    <div>
                      오픈채팅:{' '}
                      <a href={r.kakaoOpenChatUrl} target="_blank" rel="noreferrer">{r.kakaoOpenChatUrl}</a>
                    </div>
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
