import { NextResponse } from 'next/server';
import { ollamaClient } from '@/lib/ai/ollama-client';
import { db } from '@/lib/db/client';
import { processedEmails } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const ollamaAvailable = await ollamaClient.isAvailable();

    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        needsAction: sql<number>`count(*) filter (where needs_action = true)`,
        errors: sql<number>`count(*) filter (where processing_error is not null)`,
        avgProcessingTime: sql<number>`avg(processing_time_ms)`,
      })
      .from(processedEmails);

    return NextResponse.json({
      ollama: {
        available: ollamaAvailable,
        baseUrl: process.env.OLLAMA_BASE_URL,
        model: process.env.OLLAMA_EMAIL_MODEL,
      },
      stats: stats[0],
      status: ollamaAvailable ? 'healthy' : 'degraded',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, status: 'error' },
      { status: 500 }
    );
  }
}
