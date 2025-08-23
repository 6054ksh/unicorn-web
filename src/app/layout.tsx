import Script from 'next/script';
import AddToHomePrompt from '@/components/AddToHomePrompt';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Kakao JS SDK */}
        <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js" strategy="afterInteractive" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        {/* PWA 설치 유도 */}
        <AddToHomePrompt />
        {children}
      </body>
    </html>
  );
}
