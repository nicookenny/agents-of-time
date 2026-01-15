import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { processedEmails } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const needsAction = searchParams.get('needsAction');
    const actionableBy = searchParams.get('actionableBy');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = db.select().from(processedEmails);

    const filters = [];
    if (needsAction === 'true') {
      filters.push(eq(processedEmails.needsAction, true));
    }
    if (actionableBy) {
      filters.push(eq(processedEmails.actionableBy, actionableBy as any));
    }

    if (filters.length > 0) {
      query = query.where(and(...filters)) as any;
    }

    const results = await query
      .orderBy(desc(processedEmails.receivedDate))
      .limit(limit);

    return NextResponse.json({
      emails: results,
      count: results.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
