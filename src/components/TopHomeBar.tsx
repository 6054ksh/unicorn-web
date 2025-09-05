'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function TopHomeBar() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null; // 어드민 페이지는 숨김

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 80,
        display: 'flex',
        gap: 8,
      }}
    >
      <a
        href="/"
        style={{
          textDecoration: 'none',
          background: '#111',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 999,
          border: '1px solid #111',
          fontSize: 13,
          boxShadow: '0 4px 10px rgba(0,0,0,.08)',
        }}
        title="홈으로"
      >
        🏠 홈
      </a>
    </div>
  );
}
