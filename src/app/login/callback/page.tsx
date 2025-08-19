'use client';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL)
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');
  const fallback = 'https://unicorn-web-git-main-6054kshs-projects.vercel.app';
  if (typeof window === 'undefined') return fallback;
  return window.location.origin || fallback;
}

function safeDecode(input: string | null): string | null {
  if (!input) return null;
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function extractNextFromState(stateRaw: string | null): string | null {
  const s = safeDecode(stateRaw);
  if (!s) return null;
  const asParams = new URLSearchParams(s);
  const next1 = asParams.get('next');
  if (next1) return next1;
  if (s.startsWith('/') || s.startsWith('http')) return s;
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj.next === 'string') return obj.next;
  } catch {}
  return null;
}

function CallbackInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [msg, setMsg] = useState('처리 중...');
  const ran = useRef(false);
  const baseUrl = useMemo(() => getBaseUrl(), []);
  const redirectUri = useMemo(() => `${baseUrl}/login/callback`, [baseUrl]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = sp.get('code');
    const error = sp.get('error');
    const errorDesc = sp.get('error_description');
    const state = sp.get('state');
    const nextPath = extractNextFromState(state) || '/';

    let aborted = false;
    const setMessage = (m: string) => !aborted && setMsg(m);

    (async () => {
      try {
        if (error) throw new Error(`카카오 로그인 실패: ${errorDesc || error}`);
        if (!code) throw new Error('인가 코드가 없습니다.');

        // 1) code → access_token
        setMessage('카카오 토큰 교환 중...');
        const res = await fetch(
          `/api/auth/kakao-exchange?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}`,
          { method: 'GET', cache: 'no-store', credentials: 'same-origin' }
        );
        let tokenJson: any;
        try {
          tokenJson = await res.json();
        } catch {
          throw new Error('카카오 토큰 응답 파싱 실패');
        }
        if (!res.ok) {
          throw new Error(tokenJson?.error || tokenJson?.raw?.error_description || '토큰 교환 실패');
        }
        const accessToken: string | undefined = tokenJson.access_token;
        if (!accessToken) throw new Error('access_token이 없습니다.');

        // 2) 커스텀 토큰 발급
        setMessage('커스텀 토큰 발급 중...');
        const ctRes = await fetch('/api/auth/kakao-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
          cache: 'no-store',
          credentials: 'same-origin',
        });
        let ct: any;
        try {
          ct = await ctRes.json();
        } catch {
          throw new Error('커스텀 토큰 응답 파싱 실패');
        }
        if (!ctRes.ok || !ct?.customToken) {
          throw new Error(ct?.error || '커스텀 토큰 발급 실패');
        }

        // 3) Firebase 로그인
        setMessage('Firebase 로그인 중...');
        const auth = getAuth(firebaseApp);
        await signInWithCustomToken(auth, ct.customToken);

        setMessage('로그인 완료! 이동합니다...');
        router.replace(nextPath);
      } catch (e: unknown) {
        console.error(e);
        setMessage(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      aborted = true;
    };
  }, [sp, router, redirectUri]);

  return (
    <main style={{ padding: 24 }}>
      <h1>카카오 로그인 처리</h1>
      <p>{msg}</p>
      <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
        redirect_uri: <code>{redirectUri}</code>
      </p>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 24 }}>
          <h1>카카오 로그인 처리</h1>
          <p>처리 중...</p>
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
