import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/oauth/google';
import { v4 as uuid } from 'uuid';

export async function GET() {
  const state = uuid();
  const authUrl = getAuthUrl('gmail', state);
  return NextResponse.redirect(authUrl);
}
