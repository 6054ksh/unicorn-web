import Script from 'next/script';
import FcmRegistrar from '@/components/FcmRegistrar';
import GlobalQuickBar from '@/components/GlobalQuickBar';
import FloatingBell from '@/components/FloatingBell';
import NavDrawer from '@/components/NavDrawer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      <body style={{ background:'#f9fafb', color:'#111' }}>
        <FcmRegistrar />
        <NavDrawer />
        {children}
        <GlobalQuickBar />
        <FloatingBell />
      </body>
    </html>
  );
}
