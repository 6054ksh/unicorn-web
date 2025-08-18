// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // 빌드 중 ESLint 오류 무시 (경고만 표시)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 타입 오류가 있어도 빌드 진행 (임시 조치)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
