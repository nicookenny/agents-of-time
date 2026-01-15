import { NextResponse } from 'next/server';
import { getAuthUrl, type OAuthService } from '@/lib/oauth/google';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const service = url.searchParams.get('service') as OAuthService;

  if (!service || !['gmail', 'calendar'].includes(service)) {
    return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
  }

  const state = randomUUID();
  const authUrl = getAuthUrl(service, state);

  return NextResponse.redirect(authUrl);
}
