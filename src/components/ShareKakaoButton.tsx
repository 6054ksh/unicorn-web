// src/components/ShareKakaoButton.tsx
'use client';
import { useEffect } from 'react';

declare global { interface Window { Kakao?: any } }

export default function ShareKakaoButton({
  id,
  title,
  place,        // ← location -> place 로 변경
  startAt,
}: {
  id: string;
  title: string;
  place?: string;
  startAt?: string;
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const K = window.Kakao;
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (K && !K.isInitialized?.() && key) K.init(key);
  }, []);

  const share = () => {
    if (typeof window === 'undefined') return;
    const K = window.Kakao;
    if (!K?.Link) {
      alert('카카오 SDK 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const origin = window.location?.origin || '';     // ← 전역 location 사용
    const url = `${origin}/room/${id}`;
    const desc =
      `${place ?? ''}${startAt ? ` · ${new Date(startAt).toLocaleString()}` : ''}`;

    K.Link.sendDefault({
      objectType: 'feed',
      content: {
        title,
        description: desc,
        imageUrl: `${origin}/logo512.png`, // 프로젝트에 맞는 이미지로 바꿔도 됩니다.
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '모임 보러가기', link: { mobileWebUrl: url, webUrl: url } }],
    });
  };

  return (
    <button
      onClick={share}
      style={{
        padding:'8px 12px',
        borderRadius:8,
        border:'1px solid #ddd',
        background:'#fffbea',
        cursor:'pointer'
      }}
      title="카카오톡으로 이 모임을 공유합니다"
    >
      카카오톡으로 공유하기
    </button>
  );
}
