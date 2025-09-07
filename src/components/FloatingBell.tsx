'use client';

import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

type NotiItem = {
  id: string;
  type: 'vote-reminder' | 'room-created' | 'generic';
  title: string;
  body?: string;
  url?: string;
  createdAt?: string; // ISO
  unread?: boolean;
};

export default function FloatingBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<NotiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 패널 토글
  const toggle = () => setOpen((v) => !v);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // 열릴 때 목록 로드 (기존 API 라우트가 있다면 거기서 읽습니다. 없으면 빈 목록)
  useEffect(() => {
    if (!open) return;
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const res = await authedFetch('/api/notifications/list?limit=50', { method: 'GET' });
        if (!res.ok) {
          setItems([]);
          setCount(0);
          return;
        }
        const j = await res.json();
        if (aborted) return;
        const arr: NotiItem[] = Array.isArray(j?.notifications) ? j.notifications : [];
        setItems(arr);
        setCount((arr.filter((n) => n.unread).length) || 0);
      } catch {
        if (!aborted) {
          setItems([]);
          setCount(0);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [open]);

  const markAllRead = async () => {
    try {
      await authedFetch('/api/notifications/mark-all-read', { method: 'POST' });
      setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
      setCount(0);
    } catch {/* no-op */}
  };

  const time = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  // 투표 알림 상단 고정
  const voteTop = items.filter(i => i.type === 'vote-reminder');
  const others = items.filter(i => i.type !== 'vote-reminder');

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
      {/* 패널 (위로 확장) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 56, // 버튼 위
          width: 'min(88vw, 360px)',
          maxHeight: open ? 420 : 0,
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
      >
        <div style={{ padding: 12, borderBottom: '1px solid #f1f3f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>알림</strong>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={markAllRead}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}
            >
              모두 읽음
            </button>
          </div>
        </div>

        <div style={{ padding: 10, display: 'grid', gap: 8, maxHeight: 340, overflow: 'auto' }}>
          {loading && <div style={{ color: '#666', fontSize: 13 }}>불러오는 중…</div>}

          {!loading && voteTop.length > 0 && (
            <div style={{ border: '1px dashed #e5e7eb', borderRadius: 12, padding: 10, background: '#fff7ed' }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>🗳️ 투표 요청</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {voteTop.map((n) => (
                  <a
                    key={n.id}
                    href={n.url || '/'}
                    style={{
                      textDecoration: 'none',
                      color: '#111',
                      border: '1px solid #fde68a',
                      background: '#fffbeb',
                      padding: 10,
                      borderRadius: 10,
                      fontSize: 13,
                      display: 'grid',
                      gap: 2,
                    }}
                  >
                    <b>{n.title}</b>
                    {n.body ? <span style={{ color: '#555' }}>{n.body}</span> : null}
                    <span style={{ color: '#888', fontSize: 12 }}>{time(n.createdAt)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {!loading && others.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {others.map((n) => (
                <a
                  key={n.id}
                  href={n.url || '/'}
                  style={{
                    textDecoration: 'none',
                    color: '#111',
                    border: '1px solid #e5e7eb',
                    background: n.unread ? '#f8fafc' : '#fff',
                    padding: 10,
                    borderRadius: 10,
                    fontSize: 13,
                    display: 'grid',
                    gap: 2,
                  }}
                >
                  <b>{n.title}</b>
                  {n.body ? <span style={{ color: '#555' }}>{n.body}</span> : null}
                  <span style={{ color: '#888', fontSize: 12 }}>{time(n.createdAt)}</span>
                </a>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ color: '#666', fontSize: 13 }}>새로운 알림이 없어요.</div>
          )}
        </div>
      </div>

      {/* FAB 버튼 */}
      <button
        onClick={toggle}
        aria-label="알림 보기"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: '#111',
          color: '#fff',
          border: 'none',
          boxShadow: '0 10px 18px rgba(0,0,0,.18)',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        {/* 종 아이콘 (이모지 사용) */}
        <span role="img" aria-hidden>🔔</span>

        {/* 카운트 배지 */}
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              right: -6,
              top: -6,
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #fff',
              lineHeight: 1,
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </div>
  );
}
