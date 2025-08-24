import Script from 'next/script';
import AddToHomePrompt from '@/components/AddToHomePrompt';
import RoomRealtimeToast from '@/components/RoomRealtimeToast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js" strategy="afterInteractive" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AddToHomePrompt />
        <RoomRealtimeToast />
        {children}
      </body>
    </html>
  );
}
