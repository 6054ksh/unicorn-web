// src/lib/authedFetch.ts
'use client';

import { getAuth, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';

async function waitForIdToken(timeoutMs = 5000): Promise<string | null> {
  const auth = getAuth(firebaseApp);

  // 이미 로그인돼 있으면 즉시 시도
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      // 아래 이벤트 대기 로직으로 폴백
    }
  }

  return new Promise((resolve) => {
    let settled = false;

    const done = (val: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubAuth();
      unsubToken();
      resolve(val);
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return done(null);
      try {
        const t = await user.getIdToken();
        done(t);
      } catch {
        done(null);
      }
    });

    // 토큰 리프레시/초기 발급을 더 빨리 잡기 위한 보조 리스너
    const unsubToken = onIdTokenChanged(auth, async (user) => {
      if (!user) return; // 로그아웃 이벤트는 무시
      try {
        const t = await user.getIdToken();
        done(t);
      } catch {
        done(null);
      }
    });

    const timer = setTimeout(() => done(null), timeoutMs);
  });
}

export async function authedFetch(input: string, init: RequestInit = {}) {
  const token = await waitForIdToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // body가 있을 때만 Content-Type 지정 (GET에 강제 지정 방지)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'same-origin',
    cache: init.cache ?? 'no-store',
  });
}
