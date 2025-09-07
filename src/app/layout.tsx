// src/app/layout.tsx
import Script from 'next/script';
import FcmRegistrar from '@/components/FcmRegistrar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
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
      </body>
    </html>
  );
}
