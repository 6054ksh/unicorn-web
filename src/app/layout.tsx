// app/layout.tsx
import Script from 'next/script';
import FcmRegistrar from '@/components/FcmRegistrar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* ✅ Kakao JS SDK v2 (공식 문서의 최신 버전/무결성 값 사용) */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js"
          integrity="여기에_문서에서_복사한_SRI_값"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        {/* 전역 FCM 등록기 */}
        <FcmRegistrar />
        {children}
      </body>
    </html>
  );
}
