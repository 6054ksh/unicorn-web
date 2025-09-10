// src/components/NavDrawer.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NavDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  const Item = ({ href, label, emoji }: { href: string; label: string; emoji: string }) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',          // ⬅︎ 더 컴팩트
        height: 34,                  // ⬅︎ 균일한 높이
        borderRadius: 8,
        textDecoration: 'none',
        color: '#111',
        border: '1px solid transparent', // ⬅︎ 기본은 테두리 없음
        background: 'transparent',       // ⬅︎ 기본은 투명
        fontSize: 13,
        lineHeight: 1.2,
        transition: 'background .15s ease, border-color .15s ease, transform .08s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = '#fff';
        el.style.borderColor = '#e5e7eb';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = 'transparent';
        el.style.borderColor = 'transparent';
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22, height: 22, display: 'grid', placeItems: 'center',
          fontSize: 14, borderRadius: 6, background: '#f3f4f6', // 작은 아이콘 배경칩
          border: '1px solid #e5e7eb'
        }}
      >
        {emoji}
      </span>
      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
    </Link>
  );

  return (
    <>
      {/* 햄버거 버튼 (좌상단) */}
      <button
        aria-label="메뉴 열기"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          left: 12,
          top: 12,
          zIndex: 1100,
          width: 36,
          height: 36,
          borderRadius: 10,
          background: '#fff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0,0,0,.08)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ☰
      </button>

      {/* 홈 버튼 (우상단) */}
      <Link
        href="/"
        style={{
          position: 'fixed',
          right: 12,
          top: 12,
          zIndex: 1100,
          width: 36,
          height: 36,
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          background: '#fff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0,0,0,.08)',
          color: '#111',
          textDecoration: 'none',
          fontWeight: 800,
          fontSize: 16,
          lineHeight: 1,
        }}
        aria-label="홈으로"
      >
        ⌂
      </Link>

      {/* 사이드 드로어 */}
      <div
        role="dialog"
        aria-modal
        aria-hidden={!open}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1090,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={() => setOpen(false)}
      >
        {/* Dim */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,.28)',
            opacity: open ? 1 : 0,
            transition: 'opacity .18s ease',
          }}
        />

        {/* Panel */}
        <aside
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 196,                         // 약간 더 슬림
            transform: open ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform .18s ease',
            background: '#f8fafc',
            borderRight: '1px solid #e5e7eb',
            display: 'grid',
            gridTemplateRows: 'auto 1fr',       // 헤더 고정 + 리스트 스크롤
          }}
        >
          {/* 헤더(상단 밀착) */}
          <div
            style={{
              padding: '8px 8px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid #e5e7eb',
              background: 'linear-gradient(#ffffff, #f8fafc)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14 }}>UNIcorn</div>
            <div style={{ marginLeft: 'auto' }}>
              <button
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer',
                  lineHeight: 1, fontSize: 14
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* 목록(컴팩트 & 상단 밀착, 스크롤 가능) */}
          <div
            style={{
              padding: '6px',               // 최소 여백
              display: 'grid',
              gap: 4,                        // 아이템 간 거리 좁게
              overflowY: 'auto',
            }}
          >
            <Item href="/" label="홈" emoji="🏠" />
            <Item href="/room" label="모임 목록" emoji="🗓️" />
            <Item href="/create" label="모임 만들기" emoji="🎉" />
            <Item href="/scores" label="점수판" emoji="🏆" />
            <Item href="/feedback" label="방명록" emoji="🍀" />
          </div>
        </aside>
      </div>
    </>
  );
}
