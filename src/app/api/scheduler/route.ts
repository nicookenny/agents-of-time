import { NextResponse } from 'next/server';
import {
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
} from '@/lib/agents/scheduler';
import {
  scanForProactiveActions,
  runScheduledAgents,
} from '@/lib/agents/proactive-scanner';

export async function GET() {
  return NextResponse.json({
    running: isSchedulerRunning(),
  });
}

export async function POST(req: Request) {
  const { action } = await req.json();

  switch (action) {
    case 'start':
      startScheduler();
      return NextResponse.json({ status: 'started', running: true });

    case 'stop':
      stopScheduler();
      return NextResponse.json({ status: 'stopped', running: false });

    case 'scan':
      const scanResult = await scanForProactiveActions();
      return NextResponse.json({ status: 'scanned', ...scanResult });

    case 'run':
      const runResult = await runScheduledAgents();
      return NextResponse.json({ status: 'ran', ...runResult });

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
