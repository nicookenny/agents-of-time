import { NextResponse } from 'next/server';
import { runAgentManually } from '@/lib/agents/runner';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await runAgentManually(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Agent is not active' ? 400 : 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
