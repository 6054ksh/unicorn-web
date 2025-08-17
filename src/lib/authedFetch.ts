'use client';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';

async function waitForIdToken(timeoutMs = 5000): Promise<string | null> {
  const auth = getAuth(firebaseApp);

  // 이미 로그인 객체가 있으면 바로 토큰
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken();
  }

  // 아직이면 onAuthStateChanged 한 번 기다림
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(null); // 타임아웃 시 null
    }, timeoutMs);

    const unsub = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timer);
      unsub();
      if (!user) return resolve(null);
      resolve(await user.getIdToken());
    });
  });
}

export async function authedFetch(input: string, init: RequestInit = {}) {
  const token = await waitForIdToken(); // ✅ 토큰 준비될 때까지 대기
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers });
}
