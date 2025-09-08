// src/app/api/cron/tick/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// rooms/cron/sweep 라우트를 그대로 노출
export { GET, POST } from '@/app/api/rooms/cron/sweep/route';
