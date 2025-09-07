import Script from 'next/script';
import FcmRegistrar from '@/components/FcmRegistrar';
import TopRightPill from '@/components/TopRightPill';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <FcmRegistrar />
        <TopRightPill />
        {children}
      </body>
    </html>
  );
}
