import { NextResponse, type NextRequest } from 'next/server';
import { getPlatformRouteDecision } from '@/lib/platform/gate';

export function proxy(request: NextRequest) {
  const decision = getPlatformRouteDecision(request.nextUrl.pathname);

  if (decision.kind === 'not-found') return new NextResponse('Not Found', { status: 404 });
  if (decision.kind === 'redirect') {
    const destination = request.nextUrl.clone();
    destination.pathname = decision.destination;
    return NextResponse.redirect(destination);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/).*)'],
};
