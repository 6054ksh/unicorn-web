'use client';

import Script from 'next/script';
import { useMemo } from 'react';

const SCOPE =
  process.env.NEXT_PUBLIC_KAKAO_SCOPE?.trim() ||
  'profile_nickname profile_image';

// 고정 BASE_URL 우선 → 없으면 하드폴백 → 최후의 수단 window.origin
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL)
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  // 하드폴백: 브랜치 고정 프리뷰 도메인
  const fallback = 'https://unicorn-web-git-main-6054kshs-projects.vercel.app';
  if (typeof window === 'undefined') return fallback;
  return window.location.origin || fallback;
}

export default function LoginPage() {
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const redirectUri = useMemo(() => `${baseUrl}/login/callback`, [baseUrl]);

  const handleLogin = () => {
    const Kakao = (window as any).Kakao;

    if (!Kakao) {
      alert('Kakao SDK가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!Kakao.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!jsKey) {
        alert('KAKAO JS KEY가 설정되지 않았습니다 (.env 확인)');
        return;
      }
      Kakao.init(jsKey);
    }

    if (!Kakao.Auth) {
      alert('Kakao.Auth가 준비되지 않았습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    Kakao.Auth.authorize({
      redirectUri, // ✅ 고정된 redirectUri 사용
      scope: SCOPE,
      // 필요 시: state: 'next=/room', prompt: 'consent' 등
    });
  };

  const handleReconsent = () => {
    const Kakao = (window as any).Kakao;
    if (!Kakao?.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      Kakao?.init?.(jsKey);
    }
    Kakao?.Auth?.authorize({
      redirectUri,
      scope: SCOPE,
      prompt: 'consent',
    });
  };

  return (
    <main style={{ padding: 24 }}>
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
      <button onClick={handleLogin}>카카오로 시작하기</button>

      <p style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
        동의항목이 바뀌었거나 “잘못된 요청(KOE205)”이 나오면 재동의를 받아보세요.
      </p>
      <button onClick={handleReconsent}>프로필 동의 다시 받기</button>

      <p style={{ marginTop: 10, fontSize: 12 }}>
        scope: <code>{SCOPE}</code>
      </p>
      <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
        Redirect URI: <code>{redirectUri}</code>
      </p>
      <p style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
        위 주소가 카카오 개발자 콘솔의 Redirect URI와 100% 일치해야 합니다.
      </p>
    </main>
  );
}
