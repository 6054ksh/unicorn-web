import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST =
  process.env.NEXT_PUBLIC_PREVIEW_HOST || 'unicorn-web-git-main-6054kshs-projects.vercel.app';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host');

  // Preview 환경에서만 강제 정규화
  if (process.env.VERCEL_ENV === 'preview' && host && host !== CANONICAL_HOST) {
    const url = new URL(req.url);
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
