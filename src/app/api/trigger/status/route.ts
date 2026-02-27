import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.TRIGGER_API_KEY;
  const apiUrl = process.env.TRIGGER_API_URL || 'https://api.trigger.dev';

  const configured = !!apiKey;

  return NextResponse.json({
    configured,
    apiKeySet: !!apiKey,
    apiUrl,
  });
}
