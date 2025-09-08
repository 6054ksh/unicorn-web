// src/app/api/cron/tick/route.ts
import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// rooms/cron/sweep의 핸들러를 그대로 노출 (중복 구현 제거)
export { GET, POST } from '@/app/api/rooms/cron/sweep/route';
