'use client';

import Link from 'next/link';
import NotificationBell from '@/components/NotifyBell';

export default function GlobalQuickBar() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
          background: 'rgba(255,255,255,.92)',
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          boxShadow: '0 6px 14px rgba(0,0,0,.08)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {/* 홈 버튼 */}
        <Link
          href="/"
          aria-label="홈으로 이동"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            border: '1px solid #e5e7eb',
            borderRadius: 999,
            padding: '6px 10px',
            background: '#fff',
            color: '#111',
            fontWeight: 700,
          }}
        >
          <span role="img" aria-hidden>
            🏠
          </span>
          <span>홈</span>
        </Link>

        {/* 종(알림) */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 999,
            padding: '4px 8px',
            background: '#fff',
          }}
        >
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}
