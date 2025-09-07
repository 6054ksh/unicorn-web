// src/app/login/page.tsx
'use client';

import Script from 'next/script';
import { useMemo } from 'react';

const SCOPE = (process.env.NEXT_PUBLIC_KAKAO_SCOPE?.trim()) || 'profile_nickname profile_image';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  const fallback = 'https://unicorn-web-git-main-6054kshs-projects.vercel.app';
  if (typeof window === 'undefined') return fallback;
  return window.location.origin || fallback;
}

export default function LoginPage() {
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const redirectUri = useMemo(() => `${baseUrl}/login/callback`, [baseUrl]);

  const handleLogin = () => {
    const Kakao = (window as any).Kakao;
    if (!Kakao) return alert('Kakao SDK 로드 대기 후 다시 시도해주세요.');
    if (!Kakao.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!jsKey) return alert('KAKAO JS KEY 미설정 (.env 확인)');
      Kakao.init(jsKey);
    }
    Kakao.Auth.authorize({ redirectUri, scope: SCOPE });
  };

  const handleReconsent = () => {
    const Kakao = (window as any).Kakao;
    Kakao?.Auth?.authorize({ redirectUri, scope: SCOPE, prompt: 'consent' });
  };

  return (
    <main style={{ padding: 24, maxWidth: 640, margin:'0 auto' }}>
      <Script id="kakao-sdk" src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js" strategy="beforeInteractive" />
      <h1>로그인</h1>
      <div style={{ display:'grid', gap:10, border:'1px solid #eee', background:'#fff', borderRadius:12, padding:16 }}>
        <button onClick={handleLogin} style={{ padding:'10px 14px', fontWeight:800, borderRadius:10, border:'1px solid #111', background:'#111', color:'#fff' }}>
          카카오로 시작하기
        </button>
        <small style={{ color:'#666' }}>
          scope: <code>{SCOPE}</code><br/>
          Redirect URI: <code>{redirectUri}</code>
        </small>
        <button onClick={handleReconsent} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #ddd', background:'#fafafa' }}>
          프로필 동의 다시 받기
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <a href="/" style={{ textDecoration:'none', color:'#111', fontWeight:700 }}>← 홈으로</a>
      </div>
    </main>
  );
}
