'use client';

import Script from 'next/script';

const SCOPE = process.env.NEXT_PUBLIC_KAKAO_SCOPE
  // .env.local 에서 미설정 시 기본값: 닉네임 + 프로필 이미지
  ? process.env.NEXT_PUBLIC_KAKAO_SCOPE
  : 'profile_nickname profile_image';

export default function LoginPage() {
  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/login/callback`
      : '/login/callback';

  const handleLogin = () => {
    const Kakao = (window as any).Kakao;

    // SDK 로드/초기화 보장
    if (!Kakao) {
      alert('Kakao SDK가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!Kakao.isInitialized()) {
      const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!jsKey) {
        alert('KAKAO JS KEY가 설정되지 않았습니다 (.env.local 확인)');
        return;
      }
      Kakao.init(jsKey);
    }

    if (!Kakao.Auth) {
      alert('Kakao.Auth가 준비되지 않았습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    // 로그인 시작 (동의항목: 콘솔에서 켜둔 항목만 요청하세요)
    Kakao.Auth.authorize({
      redirectUri,
      scope: SCOPE,
      // 필요 시 동의 재요청:
      // prompt: 'consent',
      // 필요 시 계정선택:
      // prompt: 'select_account',
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
      prompt: 'consent', // 강제로 동의 화면 띄우기
    });
  };

  return (
    <main style={{ padding: 24 }}>
      {/* SDK를 인터랙션 전에 미리 로드 */}
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
        동의항목이 바뀌었거나 “잘못된 요청(KOE205)”이 나온다면 아래 버튼으로 재동의를 받아보세요.
      </p>
      <button onClick={handleReconsent}>프로필 동의 다시 받기</button>

      <p style={{ marginTop: 10, fontSize: 12 }}>
        사용 중인 scope: <code>{SCOPE}</code>
      </p>
    </main>
  );
}
