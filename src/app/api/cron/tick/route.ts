// src/app/api/cron/tick/route.ts
import 'server-only';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export { GET, POST } from '@/app/api/rooms/cron/sweep/route';
