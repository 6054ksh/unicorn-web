'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string | null;
  endAt: string | null;
  closed?: boolean;
  participantsCount?: number;
  type?: string;
  content?: string;
  state?: 'preparing' | 'ongoing' | 'ended';
};

const FETCH_URL = '/api/rooms/list?status=all&limit=200';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'preparing' | 'ongoing' | 'ended'>('all');
  const [auto, setAuto] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [actionMsg, setActionMsg] = useState<string>('');

  const [uid, setUid] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  const auth = useMemo(() => getAuth(firebaseApp), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  const fetchAll = async () => {
    setErr('');
    try {
      const res = await fetch(FETCH_URL, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'fetch failed');
      setRooms(j.rooms || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  // 종료된 방은 ensure(크론 대체)
  const ensureRoomsIfNeeded = async (list: Room[]) => {
    try {
      const now = Date.now();
      const targets = list.filter(r => !r.closed && r.endAt && new Date(r.endAt).getTime() <= now).slice(0, 5);
      // 과호출 방지: 한번에 최대 5개만
      await Promise.all(targets.map(r =>
        authedFetch('/api/rooms/ensure', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roomId: r.id }),
        }).catch(() => {})
      ));
    } catch {}
  };

  // 내가 참여한 방 id 세트
  const fetchMyIds = async () => {
    if (!uid) { setJoined(new Set()); return; }
    try {
      const res = await authedFetch('/api/rooms/my-ids');
      const j = await res.json();
      if (res.ok && Array.isArray(j.ids)) setJoined(new Set(j.ids));
      else setJoined(new Set());
    } catch {
      setJoined(new Set());
    }
  };

  useEffect(() => { (async () => { await fetchAll(); await ensureRoomsIfNeeded(rooms); })(); }, []);
  useEffect(() => {
    if (!auto) { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; return; }
    timerRef.current = setInterval(async () => {
      await fetchAll();
      await ensureRoomsIfNeeded(rooms);
    }, 10000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auto, rooms]);

  useEffect(() => { fetchMyIds(); }, [uid]);

  const filtered = useMemo(() => {
    let list = rooms.slice();
    if (tab !== 'all') list = list.filter((r) => r.state === tab);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((r) =>
        (r.title || '').toLowerCase().includes(s) ||
        (r.location || '').toLowerCase().includes(s) ||
        (r.type || '').toLowerCase().includes(s) ||
        (r.content || '').toLowerCase().includes(s)
      );
    }
    const weight = (r: Room) => (r.state === 'ongoing' ? 0 : r.state === 'preparing' ? 1 : 2);
    list.sort((a, b) => {
      const wa = weight(a); const wb = weight(b);
      if (wa !== wb) return wa - wb;
      const ta = a.startAt ? new Date(a.startAt).getTime() : 0;
      const tb = b.startAt ? new Date(b.startAt).getTime() : 0;
      return ta - tb;
    });
    return list;
  }, [rooms, q, tab]);

  const human = (iso?: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d as any)) return iso;
    return d.toLocaleString();
  };

  const ratio = (r: Room) => {
    const cap = Math.max(0, Number(r.capacity || 0));
    const joinedCount = Math.max(0, Number(r.participantsCount || 0));
    if (!cap) return 0;
    return Math.min(100, Math.round((joinedCount / cap) * 100));
  };

  const canJoin = (r: Room) => {
    if (r.closed) return false;
    if (r.state === 'ended') return false;
    const cap = Number(r.capacity || 0);
    if (cap && (r.participantsCount || 0) >= cap) return false;
    return true;
  };

  const canLeave = (r: Room) => {
    if (!uid) return false;
    if (!joined.has(r.id)) return false;
    if (r.closed || r.state === 'ended') return false;
    const now = new Date();
    if (r.startAt && now >= new Date(r.startAt)) return false; // 시작 후 나가기 금지
    return true;
  };

  const join = async (roomId: string) => {
    setActionMsg('');
    try {
      const res = await authedFetch('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || '참여 실패');
      setActionMsg('참여 완료! 목록을 새로고침합니다.');
      await fetchAll();
      await fetchMyIds();
    } catch (e: any) {
      setActionMsg(e?.message ?? String(e));
    }
  };

  const leave = async (roomId: string) => {
    setActionMsg('');
    try {
      const res = await authedFetch('/api/rooms/leave', {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || '나가기 실패');
      setActionMsg('나가기 완료! 목록을 새로고침합니다.');
      await fetchAll();
      await fetchMyIds();
    } catch (e: any) {
      setActionMsg(e?.message ?? String(e));
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 12 }}>모임 방 목록</h1>

      {/* 컨트롤 바 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, background: '#f7f7f8', borderRadius: 8, padding: 4 }}>
          {(['all','preparing','ongoing','ended'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid ' + (tab === t ? '#444' : 'transparent'),
                background: tab === t ? '#fff' : 'transparent',
                cursor: 'pointer'
              }}
            >
              {t === 'all' ? '전체' : t === 'preparing' ? '모집중' : t === 'ongoing' ? '진행중' : '종료'}
            </button>
          ))}
        </div>

        <input
          placeholder="제목/장소/종류 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', flex: '1 1 240px' }}
        />

        <button onClick={fetchAll} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd' }}>
          새로고침
        </button>
      </div>

      {loading && <p>불러오는 중…</p>}
      {err && <p style={{ color: 'crimson' }}>❌ {err}</p>}
      {actionMsg && <p style={{ color: actionMsg.includes('완료') ? 'green' : 'crimson' }}>{actionMsg}</p>}
      {!loading && !err && rooms.length === 0 && <p>표시할 방이 없습니다.</p>}

      {/* 카드 리스트 */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {filtered.map((r) => {
          const pct = ratio(r);
          const full = Number(r.capacity || 0) > 0 && (r.participantsCount || 0) >= Number(r.capacity || 0);
          const isJoined = joined.has(r.id);

          return (
            <div key={r.id} style={{ border: '1px solid #e9e9ec', borderRadius: 12, padding: 14, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <a href={`/room/${r.id}`} style={{ fontWeight: 800, fontSize: 16, color: '#111', textDecoration: 'none' }}>
                  {r.title}
                </a>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {isJoined ? (
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#F0FDFA', color: '#065F46', border: '1px solid #CCFBF1' }}>
                      참여중
                    </span>
                  ) : null}
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 999, border: '1px solid #ddd',
                    background: r.state === 'ongoing' ? '#e6f4ea' : r.state === 'ended' ? '#f3f4f6' : '#eef2ff',
                    color: r.state === 'ongoing' ? '#166534' : r.state === 'ended' ? '#374151' : '#3730a3'
                  }}>
                    {r.state === 'ongoing' ? '진행중' : r.state === 'ended' ? '종료' : '모집중'}
                  </span>
                </div>
              </div>

              <div style={{ color: '#555', fontSize: 13, marginTop: 6 }}>
                <div>장소: {r.location || '-'}</div>
                <div>시간: {human(r.startAt)} ~ {human(r.endAt)}</div>
                {r.type ? <div>종류: {r.type}</div> : null}
              </div>

              {/* 진행도 */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                  <span>정원 {r.capacity ?? 0}명</span>
                  <span>참여 {r.participantsCount ?? 0}명</span>
                </div>
                <div style={{ marginTop: 6, height: 8, background: '#f2f3f5', borderRadius: 999 }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: full ? '#ef4444' : '#3b82f6',
                    borderRadius: 999,
                    transition: 'width .3s ease'
                  }} />
                </div>
              </div>

              {/* 액션 */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a href={`/room/${r.id}`} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', textDecoration: 'none', color: '#111' }}>
                  상세보기
                </a>

                <button
                  onClick={() => join(r.id)}
                  disabled={!canJoin(r)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background: canJoin(r) ? '#111' : '#e5e7eb',
                    color: canJoin(r) ? '#fff' : '#999',
                    cursor: canJoin(r) ? 'pointer' : 'not-allowed'
                  }}
                  title={!canJoin(r) ? '정원초과/종료/닫힘' : '참여하기'}
                >
                  참여하기
                </button>

                <button
                  onClick={() => leave(r.id)}
                  disabled={!canLeave(r)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background: canLeave(r) ? '#fff' : '#e5e7eb',
                    color: canLeave(r) ? '#111' : '#999',
                    cursor: canLeave(r) ? 'pointer' : 'not-allowed'
                  }}
                  title={canLeave(r) ? '시작 전이면 나갈 수 있어요' : '시작 후/종료/미참여 상태는 불가'}
                >
                  나가기
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
