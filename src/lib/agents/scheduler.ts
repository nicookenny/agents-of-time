import { CronJob } from 'cron';
import { scanForProactiveActions, runScheduledAgents } from './proactive-scanner';

let proactiveJob: CronJob | null = null;
let scheduledJob: CronJob | null = null;
let isRunning = false;

export function startScheduler() {
  if (isRunning) {
    console.log('Scheduler already running');
    return;
  }

  proactiveJob = new CronJob(
    '*/5 * * * *',
    async () => {
      console.log('[Scheduler] Running proactive scan...');
      try {
        const result = await scanForProactiveActions();
        console.log(`[Scheduler] Proactive scan complete: ${result.triggered} agents triggered`);
      } catch (err) {
        console.error('[Scheduler] Proactive scan error:', err);
      }
    },
    null,
    true,
    'UTC'
  );

  scheduledJob = new CronJob(
    '* * * * *',
    async () => {
      try {
        const result = await runScheduledAgents();
        if (result.triggered > 0) {
          console.log(`[Scheduler] Scheduled run complete: ${result.triggered} agents triggered`);
        }
      } catch (err) {
        console.error('[Scheduler] Scheduled run error:', err);
      }
    },
    null,
    true,
    'UTC'
  );

  isRunning = true;
  console.log('[Scheduler] Started - Proactive scanner runs every 5 minutes, scheduled agents every minute');
}

export function stopScheduler() {
  if (proactiveJob) {
    proactiveJob.stop();
    proactiveJob = null;
  }
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
  }
  isRunning = false;
  console.log('[Scheduler] Stopped');
}

export function isSchedulerRunning(): boolean {
  return isRunning;
}
