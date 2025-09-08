// src/app/api/notifications/mark-all-read/route.ts
import * as impl from '@/app/api/me/notifications/mark-all-read/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  return impl.POST(req);
}
