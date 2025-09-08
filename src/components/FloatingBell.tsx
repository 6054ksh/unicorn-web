// src/components/FloatingBell.tsx
'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
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

export default function FloatingBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<NotiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = () => setOpen(v => !v);

  const fetchList = async () => {
    try {
      setLoading(true);
      // ✅ onlyUnread=1 제거 (인덱스 없이도 동작)
      const res = await authedFetch('/api/notifications/list?limit=50', { method: 'GET' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setItems([]); setCount(0); return; }

      const arr: NotiItem[] = Array.isArray(j?.notifications) ? j.notifications : [];
      const unreadCount = Number(j?.unreadCount || 0);

      const normalized = arr.map(n => {
        const next: NotiItem = { ...n };
        if (next.type === 'vote-reminder') {
          const rid = next.meta?.roomId ?? (next.url ? (next.url.match(/\/room\/([^/?#]+)/)?.[1] ?? null) : null);
          next.meta = { ...(next.meta || {}), roomId: rid };
          if (rid) next.url = `/room/${rid}`;
        }
        if (next.url && /^https?:\/\//i.test(next.url)) {
          try { const u = new URL(next.url); next.url = u.pathname + u.search + u.hash; } catch {}
        }
        return next;
      });

      setItems(normalized);
      setCount(unreadCount);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; return; }
    let aborted = false;
    (async () => { if (!aborted) await fetchList(); })();
    pollRef.current = setInterval(fetchList, 15000);
    return () => { aborted = true; if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => { if (!rootRef.current) return; if (rootRef.current.contains(e.target as Node)) return; setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('click', onDocClick, true); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const markAllRead = async () => {
    try {
      await authedFetch('/api/notifications/mark-all-read', { method: 'POST' });
      // 낙관적 업데이트 + 서버 재동기화
      setItems([]); setCount(0);
      await fetchList();
    } catch {}
  };

  const time = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toLocaleString(); } catch { return iso; } };
  // 읽음=false만 제외. (undefined, true는 보임) => 전역 공지도 표시됨
  const visible = useMemo(() => items.filter(i => i.unread !== false), [items]);

  const pillStyle = (bg: string, color: string) => ({
    display: 'inline-block', padding: '2px 8px', fontSize: 11, borderRadius: 999, background: bg, color, border: '1px solid rgba(0,0,0,.06)'
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

  const Card = ({ n }: { n: NotiItem }) => {
    const href = n.url || '/';
    return (
      <Link
        href={href}
        style={{
          textDecoration: 'none', color: '#111', border: '1px solid #e5e7eb', background: '#fff',
          padding: 10, borderRadius: 12, display: 'grid', gap: 4, fontSize: 13
        }}
        onClick={() => setOpen(false)}
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span role="img" aria-hidden>{iconOf(n.type)}</span>
          <b style={{ lineHeight: 1.2 }}>{n.title}</b>
          <span style={{ marginLeft: 'auto' }}>{labelOf(n.type)}</span>
        </div>
        {n.body ? <div style={{ color: '#555' }}>{n.body}</div> : null}
        <div style={{ color: '#888', fontSize: 12 }}>{time(n.createdAt)}</div>
      </Link>
    );
  };

  return (
    <div ref={rootRef} style={{ position: 'fixed', left: 'max(12px, env(safe-area-inset-left))', bottom: 'max(12px, env(safe-area-inset-bottom))', zIndex: 1000 }}>
      {/* 패널 */}
      <div
        style={{
          position: 'absolute', left: 0, bottom: 56,
          width: 'min(88vw, 360px)', maxHeight: open ? 480 : 0,
          overflow: 'hidden', borderRadius: 16,
          border: open ? '1px solid #e5e7eb' : '1px solid transparent',
          background: 'rgba(255,255,255,.98)', boxShadow: open ? '0 12px 28px rgba(0,0,0,.12)' : 'none',
          backdropFilter: 'blur(6px)', transform: open ? 'translateY(0)' : 'translateY(8px)', opacity: open ? 1 : 0,
          transition: 'all .18s ease', pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #f1f3f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>알림</strong>
          <button onClick={markAllRead} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
            모두 읽음
          </button>
        </div>

        <div style={{ padding: 10, display: 'grid', gap: 8, maxHeight: 400, overflow: 'auto' }}>
          {loading && <div style={{ color: '#666', fontSize: 13 }}>불러오는 중…</div>}
          {!loading && visible.length > 0 && <div style={{ display: 'grid', gap: 8 }}>{visible.map(n => <Card key={n.id} n={n} />)}</div>}
          {!loading && visible.length === 0 && <div style={{ color: '#666', fontSize: 13 }}>새로운 알림이 없어요.</div>}
        </div>
      </div>

      {/* 좌하단 종 버튼 */}
      <button
        onClick={toggle} aria-label="알림 패널 열기" aria-expanded={open}
        style={{
          width: 44, height: 44, borderRadius: 999, background: '#111', color: '#fff', border: 'none',
          boxShadow: '0 10px 18px rgba(0,0,0,.18)', position: 'relative', cursor: 'pointer'
        }}
      >
        <span role="img" aria-hidden>🔔</span>
        {count > 0 && (
          <span
            style={{
              position: 'absolute', right: -6, top: -6, minWidth: 20, height: 20, padding: '0 6px',
              borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 12,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', lineHeight: 1,
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
