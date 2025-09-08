'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { authedFetch } from '@/lib/authedFetch';

type NotiItem = {
  id: string;
  scope?: 'user' | 'global';
  type: 'vote-reminder' | 'participant-joined' | 'under-min-closed' | 'room-created' | 'generic' | string;
  title: string;
  body?: string;
  url?: string;
  createdAt?: string;
  unread?: boolean;
  meta?: { roomId?: string | null };
};

type UserLite = { uid: string; name?: string; profileImage?: string };

export default function FloatingBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<NotiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = () => setOpen(v => !v);

  // 목록 불러오기
  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await authedFetch('/api/notifications/list?limit=50', { method: 'GET' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems([]);
        setCount(0);
        return;
      }
      const arr: NotiItem[] = Array.isArray(j?.notifications) ? j.notifications : [];
      const unreadCount = Number(j?.unreadCount || 0);

      // vote-reminder에 roomId 메타 보강 (url=/room/:id 패턴 파싱)
      const normalized = arr.map(n => {
        if (n.type === 'vote-reminder') {
          const rid = n.meta?.roomId ??
            (n.url ? (n.url.match(/\/room\/([^/?#]+)/)?.[1] ?? null) : null);
          return { ...n, meta: { ...(n.meta || {}), roomId: rid } };
        }
        return n;
      });

      setItems(normalized);
      setCount(unreadCount);
    } finally {
      setLoading(false);
    }
  };

  // 패널 열릴 때 가져오고, 열려 있는 동안 15초마다 갱신
  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    let aborted = false;
    (async () => { if (!aborted) await fetchList(); })();
    pollRef.current = setInterval(fetchList, 15000);
    return () => { aborted = true; if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
  }, [open]);

  // 패널 바깥 클릭/ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const markAllRead = async () => {
    try {
      await authedFetch('/api/notifications/mark-all-read', { method: 'POST' });
      // 1) 낙관적 업데이트
      setItems(prev => prev.map(n => ({ ...n, unread: false })));
      setCount(0);
      // 2) 서버와 재동기화
      await fetchList();
    } catch {
      // 실패 시엔 기존 상태 유지
    }
  };

  const time = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  // 투표 알림 우선
  const voteTop = items.filter(i => i.type === 'vote-reminder');
  const others = items.filter(i => i.type !== 'vote-reminder');

  const pillStyle = (bg: string, color: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    borderRadius: 999,
    background: bg,
    color,
    border: '1px solid rgba(0,0,0,.06)'
  });

  const iconOf = (t: string) =>
    t === 'vote-reminder'     ? '🗳️' :
    t === 'participant-joined'? '🎈' :
    t === 'under-min-closed'  ? '🥺' :
    t === 'room-created'      ? '🎉' : '🔔';

  const labelOf = (t: string) =>
    t === 'vote-reminder'     ? <span style={pillStyle('#fffbeb', '#92400e')}>투표 요청</span> :
    t === 'participant-joined'? <span style={pillStyle('#ecfeff', '#155e75')}>새 멤버 참여</span> :
    t === 'under-min-closed'  ? <span style={pillStyle('#fee2e2', '#991b1b')}>최소인원 미달</span> :
    t === 'room-created'      ? <span style={pillStyle('#eef2ff', '#3730a3')}>새 모임</span> :
                                <span style={pillStyle('#f3f4f6', '#374151')}>알림</span>;

  const Card = ({ n }: { n: NotiItem }) => (
    <a
      href={n.url || '/'}
      style={{
        textDecoration: 'none',
        color: '#111',
        border: '1px solid #e5e7eb',
        background: n.unread ? '#f8fafc' : '#fff',
        padding: 10,
        borderRadius: 12,
        display: 'grid', gap: 4, fontSize: 13
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span role="img" aria-hidden>{iconOf(n.type)}</span>
        <b style={{ lineHeight: 1.2 }}>{n.title}</b>
        <span style={{ marginLeft: 'auto' }}>{labelOf(n.type)}</span>
      </div>
      {n.body ? <div style={{ color: '#555' }}>{n.body}</div> : null}
      <div style={{ color: '#888', fontSize: 12 }}>{time(n.createdAt)}</div>
    </a>
  );

  // ─────────────────────────────────────────────
  // 인라인 투표 카드
  // ─────────────────────────────────────────────
  const VoteInlineCard: React.FC<{ roomId: string; onSubmitted: () => void }> = ({ roomId, onSubmitted }) => {
    const [participants, setParticipants] = useState<UserLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [thumbsForUid, setThumbsForUid] = useState<string>('');
    const [heartForUid, setHeartForUid] = useState<string>('');
    const [noshowUid, setNoshowUid] = useState<'none' | string>('none');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
      let aborted = false;
      (async () => {
        try {
          setLoading(true);
          const r = await authedFetch(`/api/rooms/get?id=${roomId}`);
          if (!r.ok) throw new Error('방 정보를 불러오지 못했습니다');
          const room = await r.json();
          const uids: string[] = Array.isArray(room?.participants) ? room.participants : [];

          // 사용자 이름 조회 (있으면), 없으면 uid로 fallback
          const users = await Promise.all(
            uids.map(async (uid: string) => {
              try {
                const ur = await authedFetch(`/api/users/get?uid=${encodeURIComponent(uid)}`);
                if (ur.ok) {
                  const u = await ur.json();
                  return { uid, name: u?.name || undefined, profileImage: u?.profileImage || undefined };
                }
              } catch {}
              return { uid };
            })
          );
          if (!aborted) setParticipants(users);
        } catch (e: any) {
          if (!aborted) setErr(e?.message ?? '불러오기 실패');
        } finally {
          if (!aborted) setLoading(false);
        }
      })();
      return () => { aborted = true; };
    }, [roomId]);

    const submit = async () => {
      try {
        setSubmitting(true);
        const res = await authedFetch('/api/rooms/vote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            roomId,
            thumbsForUid: thumbsForUid || null,
            heartForUid: heartForUid || null,
            noshowUid,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || '투표 실패');

        // 제출되면 알림 읽음 처리 + 리스트 리프레시
        await authedFetch('/api/notifications/mark-all-read', { method: 'POST' });
        onSubmitted();
      } catch (e: any) {
        setErr(e?.message ?? '투표 실패');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, background: '#fff' }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>🗳️ 이 모임에 바로 투표하기</div>
        {loading && <div style={{ fontSize: 13, color: '#666' }}>참여자 불러오는 중…</div>}
        {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}
        {!loading && !err && (
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12 }}>👍 칭찬하고 싶은 사람</label>
            <select
              value={thumbsForUid}
              onChange={e => setThumbsForUid(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}
            >
              <option value="">선택 안 함</option>
              {participants.map(p => (
                <option key={p.uid} value={p.uid}>{p.name || p.uid}</option>
              ))}
            </select>

            <label style={{ fontSize: 12 }}>❤️ 고마운 사람</label>
            <select
              value={heartForUid}
              onChange={e => setHeartForUid(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}
            >
              <option value="">선택 안 함</option>
              {participants.map(p => (
                <option key={p.uid} value={p.uid}>{p.name || p.uid}</option>
              ))}
            </select>

            <label style={{ fontSize: 12 }}>🚫 노쇼</label>
            <select
              value={noshowUid}
              onChange={e => setNoshowUid((e.target.value as any) || 'none')}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}
            >
              <option value="none">없음</option>
              {participants.map(p => (
                <option key={p.uid} value={p.uid}>{p.name || p.uid}</option>
              ))}
            </select>

            <button
              onClick={submit}
              disabled={submitting}
              style={{ padding: '8px 12px', borderRadius: 8, background: '#111', color: '#fff', border: '1px solid #111' }}
            >
              {submitting ? '제출 중…' : '제출'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const voteNoti = useMemo(
    () => items.find(n => n.type === 'vote-reminder' && n.meta?.roomId),
    [items]
  );

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        left: 'max(12px, env(safe-area-inset-left))',
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 1000,
      }}
    >
      {/* 패널 */}
      <div
        style={{
          position: 'absolute', left: 0, bottom: 56,
          width: 'min(88vw, 360px)', maxHeight: open ? 480 : 0,
          overflow: 'hidden',
          borderRadius: 16,
          border: open ? '1px solid #e5e7eb' : '1px solid transparent',
          background: 'rgba(255,255,255,.98)',
          boxShadow: open ? '0 12px 28px rgba(0,0,0,.12)' : 'none',
          backdropFilter: 'blur(6px)',
          transform: open ? 'translateY(0)' : 'translateY(8px)',
          opacity: open ? 1 : 0,
          transition: 'all .18s ease',
          pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #f1f3f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>알림</strong>
          <button
            onClick={markAllRead}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
            모두 읽음
          </button>
        </div>

        <div style={{ padding: 10, display: 'grid', gap: 8, maxHeight: 400, overflow: 'auto' }}>
          {loading && <div style={{ color: '#666', fontSize: 13 }}>불러오는 중…</div>}

          {/* 인라인 투표 UI 한 블록 */}
          {!loading && voteNoti?.meta?.roomId && (
            <div style={{ border: '1px dashed #e5e7eb', borderRadius: 12, padding: 10, background: '#fff7ed' }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>🗳️ 투표가 도착했어요!</div>
              <VoteInlineCard
                roomId={voteNoti.meta.roomId}
                onSubmitted={fetchList}
              />
            </div>
          )}

          {/* 일반 카드 */}
          {!loading && items.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {items.map(n => (
                // vote-reminder도 카드로 표시(인라인과 중복 허용)
                <Card key={n.id} n={n} />
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ color: '#666', fontSize: 13 }}>새로운 알림이 없어요.</div>
          )}
        </div>
      </div>

      {/* 좌하단 종 버튼 */}
      <button
        onClick={toggle}
        aria-label="알림 패널 열기"
        aria-expanded={open}
        style={{
          width: 44, height: 44, borderRadius: 999,
          background: '#111', color: '#fff', border: 'none',
          boxShadow: '0 10px 18px rgba(0,0,0,.18)',
          position: 'relative', cursor: 'pointer'
        }}
      >
        <span role="img" aria-hidden>🔔</span>
        {count > 0 && (
          <span
            style={{
              position: 'absolute', right: -6, top: -6,
              minWidth: 20, height: 20, padding: '0 6px',
              borderRadius: 999, background: '#ef4444', color: '#fff',
              fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff', lineHeight: 1,
            }}
            aria-label={`읽지 않은 알림 ${count}개`}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </div>
  );
}
