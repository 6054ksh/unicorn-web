'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
// 기존 종 알림 컴포넌트가 있다면 그대로 사용하세요.
import NotificationBell from '@/components/NotifyBell';

export default function TopRightPill() {
  const pathname = usePathname();
  // admin 페이지에서는 노출 안 함
  if (pathname?.startsWith('/admin')) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 14,
        zIndex: 50,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'saturate(180%) blur(10px)',
        border: '1px solid #eee',
        borderRadius: 999,
        padding: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 999,
          border: '1px solid #e9e9ec',
          background: '#fff',
          fontWeight: 700,
          textDecoration: 'none',
          color: '#111',
          width: '100%',
          justifyContent: 'center',
        }}
        title="홈으로"
      >
        🏠 홈
      </Link>

      {/* 종모양 버튼 (기존 NotificationBell 컴포넌트 사용) */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          borderRadius: 999,
          border: '1px solid #e9e9ec',
          background: '#fff',
          width: '100%',
        }}
        title="알림"
      >
        <NotificationBell />
      </div>
    </div>
  );
}
