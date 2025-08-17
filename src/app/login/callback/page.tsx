'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

export default function KakaoCallbackPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const code = sp.get('code');
  const error = sp.get('error');
  const [msg, setMsg] = useState('처리 중...');

  useEffect(() => {
    (async () => {
      try {
        if (error) throw new Error('카카오 로그인 실패: ' + error);
        if (!code) throw new Error('인가 코드가 없습니다.');

        // 1) 인가코드 → access_token
        const res = await fetch(`/api/auth/kakao-exchange?code=${encodeURIComponent(code)}`);
        const tokenJson = await res.json();
        if (!res.ok) throw new Error(tokenJson?.error || '토큰 교환 실패');

        const accessToken: string = tokenJson.access_token;
        if (!accessToken) throw new Error('access_token 없음');

        // 2) (변경) Next API Route 호출 → 커스텀 토큰 수신
        const ctRes = await fetch('/api/auth/kakao-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });
        const ct = await ctRes.json();
        if (!ctRes.ok) throw new Error(ct?.error || '커스텀 토큰 발급 실패');

        // 3) Firebase Auth 로그인
        const auth = getAuth(firebaseApp);
        await signInWithCustomToken(auth, ct.customToken);

        setMsg('로그인 완료! 홈으로 이동합니다...');
        router.replace('/');
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? String(e));
      }
    })();
  }, [code, error, router]);

  return (
    <main style={{ padding: 24 }}>
      <h1>카카오 로그인 처리</h1>
      <p>{msg}</p>
    </main>
  );
}
