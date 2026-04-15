import { NextRequest, NextResponse } from 'next/server';

const ROLE_REQUIRED: Record<string, string> = {
  '/manager': 'FarmManager',
  '/worker':  'Worker',
};

export function middleware(req: NextRequest) {
  const role = req.cookies.get('role')?.value;
  const path = req.nextUrl.pathname;

  for (const [prefix, required] of Object.entries(ROLE_REQUIRED)) {
    if (path.startsWith(prefix) && role !== required) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/manager/:path*', '/worker/:path*'],
};
