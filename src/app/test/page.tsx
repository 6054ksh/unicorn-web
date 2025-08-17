'use client';

import { useState } from 'react';
import { firebaseApp } from '@/lib/firebase';  // 상대경로라면 ../../lib/firebase

export default function TestPage() {
  const [status, setStatus] = useState('');

  const writeTest = async () => {
    try {
      // ★ 여기서 Firestore 모듈을 동적으로 불러와요.
      const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = getFirestore(firebaseApp);

      await addDoc(collection(db, 'test'), {
        message: 'Hello UNIcorn!',
        createdAt: serverTimestamp(),
      });

      setStatus('✅ Firestore 쓰기 성공! (콘솔에서 test 컬렉션 확인)');
    } catch (e: any) {
      setStatus('❌ 실패: ' + (e?.message ?? String(e)));
      console.error(e);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Firestore 연결 테스트</h1>
      <button onClick={writeTest}>테스트 문서 쓰기</button>
      <p style={{ marginTop: 12 }}>{status}</p>
    </main>
  );
}
