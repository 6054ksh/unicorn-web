// src/app/layout.tsx
import Script from 'next/script';
import FcmRegistrar from '@/components/FcmRegistrar';
import GlobalQuickBar from '@/components/GlobalQuickBar';
import FloatingBell from '@/components/FloatingBell';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />

        {/* Kakao SDK */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body style={{ background:'#f9fafb', color:'#111' }}>
        <FcmRegistrar />
        {children}
        <GlobalQuickBar />
        <FloatingBell />
      </body>
    </html>
  );
}
