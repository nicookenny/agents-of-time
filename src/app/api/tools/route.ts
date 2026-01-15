import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { tools, toolCategories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const allTools = await db
    .select({
      id: tools.id,
      name: tools.name,
      identifier: tools.identifier,
      description: tools.description,
      configSchema: tools.configSchema,
      requiresOauth: tools.requiresOauth,
      category: {
        id: toolCategories.id,
        name: toolCategories.name,
      },
    })
    .from(tools)
    .leftJoin(toolCategories, eq(tools.categoryId, toolCategories.id));

  return NextResponse.json(allTools);
}
