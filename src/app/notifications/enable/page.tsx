// ✅ Server Component (no 'use client')
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import EnableClient from './EnableClient';

export default function Page() {
  // 서버는 단지 클라이언트 컴포넌트를 렌더만 합니다.
  return <EnableClient />;
}
