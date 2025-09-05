import Script from 'next/script';
import FcmRegistrar from '@/components/FcmRegistrar';
import TopHomeBar from '@/components/TopHomeBar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js"
          integrity="여기에_문서에서_복사한_SRI_값"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <TopHomeBar />
        <FcmRegistrar />
        {children}
      </body>
    </html>
  );
}


