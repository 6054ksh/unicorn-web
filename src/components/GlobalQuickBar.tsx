'use client';

import Link from 'next/link';

export default function GlobalHomeButton() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(12px, env(safe-area-inset-top))',
        right: 'max(12px, env(safe-area-inset-right))',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <Link
          href="/"
          aria-label="홈으로 이동"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
            borderRadius: 999,
            padding: '8px 12px',
            background: 'rgba(255,255,255,.95)',
            color: '#111',
            fontWeight: 800,
            boxShadow: '0 6px 14px rgba(0,0,0,.08)',
            backdropFilter: 'blur(6px)',
            lineHeight: 1,
          }}
        >
          <span role="img" aria-hidden style={{ marginRight: 6 }}>🏠</span>
          <span>홈</span>
        </Link>
      </div>
    </div>
  );
}
