'use client';

import Link from 'next/link';
import NotificationBell from '@/components/NotifyBell';

export default function GlobalQuickBar() {
  return (
    <div
      // 고정 위치 + 안전 여백(safe-area)
      style={{
        position: 'fixed',
        top: 'max(12px, env(safe-area-inset-top))',
        right: 'max(12px, env(safe-area-inset-right))',
        zIndex: 1000,
        // 바깥은 클릭 통과
        pointerEvents: 'none',
      }}
    >
      <div
        // 실제 인터랙션 영역
        style={{
          pointerEvents: 'auto',
          // 패널
          display: 'block',
          padding: 8,
          background: 'rgba(255,255,255,.92)',
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          boxShadow: '0 6px 14px rgba(0,0,0,.08)',
          backdropFilter: 'blur(6px)',
          // 알림 드롭다운이 밖으로 펼쳐져도 보이도록
          overflow: 'visible',
        }}
      >
        {/* 홈 버튼 */}
        <Link
          href="/"
          aria-label="홈으로 이동"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
            border: '1px solid #e5e7eb',
            borderRadius: 999,
            padding: '6px 10px',
            background: '#fff',
            color: '#111',
            fontWeight: 700,
            // 아이콘과 텍스트 간격: margin으로 처리 (iPad Safari 구버전 gap 회피)
            lineHeight: 1,
          }}
        >
          <span role="img" aria-hidden style={{ marginRight: 6 }}>🏠</span>
          <span>홈</span>
        </Link>

        {/* 간격: gap 대신 명시적 margin */}
        <div style={{ height: 8 }} />

        {/* 종(알림) - 드롭다운이 겹치지 않도록 컨테이너 relative */}
        <div style={{ position: 'relative' }}>
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}
