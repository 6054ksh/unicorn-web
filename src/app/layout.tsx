import Script from 'next/script';
import AddToHomePrompt from '@/components/AddToHomePrompt';
import RoomRealtimeToast from '@/components/RoomRealtimeToast';
import FcmRegistrar from '@/components/FcmRegistrar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js"
          strategy="afterInteractive"
        />
      </head>
      <body style={{ background:'#fafbfd', color:'#0f172a', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif' }}>
        <FcmRegistrar />
        {children}
      </body>
    </html>
  );
}

