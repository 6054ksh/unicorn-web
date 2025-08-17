'use client';

import { useEffect, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
// (선택) Firestore에서 프로필도 읽고 싶으면 주석 해제
// import { getFirestore, doc, getDoc } from 'firebase/firestore';

export default function MePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid ?? null);

      // 커스텀 토큰 로그인은 displayName이 비어있는 경우가 많아요.
      // 우리는 Firestore users/{uid}에 name을 저장했으니, 원하면 이렇게 읽어올 수 있어요.
      // const db = getFirestore(firebaseApp);
      // if (user) {
      //   const snap = await getDoc(doc(db, 'users', user.uid));
      //   setName((snap.data() as any)?.name ?? null);
      // } else {
      //   setName(null);
      // }
    });
    return () => unsub();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>내 로그인 상태</h1>
      <p>UID: {uid ?? '로그아웃 상태'}</p>
      {name && <p>이름: {name}</p>}
    </main>
  );
}
