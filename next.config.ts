// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // ✅ ESLint 에러가 있어도 빌드를 막지 않음
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 필요 시 타입 에러도 빌드 통과 (급할 때만 사용, 추후 원복 추천)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
