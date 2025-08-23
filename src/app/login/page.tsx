// src/app/login/page.tsx
'use client';

import Script from 'next/script';
import { useMemo } from 'react';

const SCOPE = process.env.NEXT_PUBLIC_KAKAO_SCOPE?.trim() || 'profile_nickname profile_image';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL)
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  const fallback = 'https://unicorn-web-git-main-6054kshs-projects.vercel.app';
  if (typeof window === 'undefined') return fallback;
  return window.location.origin || fallback;
}

export default function LoginPage() {
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const redirectUri = useMemo(() => `${baseUrl}/login/callback`, [baseUrl]);

  const handleLogin = () => {
    const Kakao = (window as any).Kakao;
    if (!Kakao) return alert('Kakao SDK가 아직 로드되지 않았습니다.');
    if (!Kakao.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!jsKey) return alert('KAKAO JS KEY가 설정되지 않았습니다 (.env 확인)');
      Kakao.init(jsKey);
    }
    if (!Kakao.Auth) return alert('Kakao.Auth가 준비되지 않았습니다. 새로고침 후 다시 시도해주세요.');

    Kakao.Auth.authorize({ redirectUri, scope: SCOPE });
  };

  const handleReconsent = () => {
    const Kakao = (window as any).Kakao;
    if (!Kakao?.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      Kakao?.init?.(jsKey);
    }
    Kakao?.Auth?.authorize({ redirectUri, scope: SCOPE, prompt: 'consent' });
  };

  return (
    <main style={{ padding: 24, maxWidth: 640, margin:'0 auto' }}>
      <Script
        id="kakao-sdk"
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js"
        strategy="beforeInteractive"
        onLoad={() => {
          const Kakao = (window as any).Kakao;
          if (Kakao && !Kakao.isInitialized()) {
            const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
            if (jsKey) Kakao.init(jsKey);
          }
        }}
      />
      <h1>로그인</h1>
      <button onClick={handleLogin} style={btnPrimary}>카카오로 시작하기</button>

      <div style={mutedBox}>
        <p style={{ margin:0, fontSize:12, color:'#666' }}>
          동의항목이 바뀌었거나 “잘못된 요청(KOE205)”이 나오면 재동의를 받아보세요.
        </p>
        <button onClick={handleReconsent} style={{ ...btnSecondary, marginTop:8 }}>프로필 동의 다시 받기</button>
      </div>

      <p style={{ marginTop: 10, fontSize: 12 }}>scope: <code>{SCOPE}</code></p>
      <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>Redirect URI: <code>{redirectUri}</code></p>
      <p style={{ marginTop: 4, fontSize: 12, color: '#888' }}>※ 카카오 콘솔의 Redirect URI와 100% 일치해야 합니다.</p>
    </main>
  );
}

const btnPrimary: React.CSSProperties = { padding:'10px 14px', borderRadius:10, border:'1px solid #111', background:'#111', color:'#fff', cursor:'pointer' };
const btnSecondary: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', background:'#fff', color:'#111', cursor:'pointer' };
const mutedBox: React.CSSProperties = { marginTop:10, border:'1px solid #eee', borderRadius:10, padding:12, background:'#fafafa' };
