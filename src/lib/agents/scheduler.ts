import { CronJob } from 'cron';
import { scanForProactiveActions, runScheduledAgents } from './proactive-scanner';
import { emailPoller } from '@/lib/services/email-poller';

let proactiveJob: CronJob | null = null;
let scheduledJob: CronJob | null = null;
let emailPollJob: CronJob | null = null;
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

  emailPollJob = new CronJob(
    '* * * * *',
    async () => {
      try {
        const result = await emailPoller.pollAllAccounts();
        if (result.totalProcessed > 0 || result.totalAgents > 0) {
          console.log(
            `[Scheduler] Email poll complete: ${result.totalProcessed} emails processed, ${result.totalAgents} agents triggered`
          );
        }
      } catch (err) {
        console.error('[Scheduler] Email poll error:', err);
      }
    },
    null,
    true,
    'UTC'
  );

  isRunning = true;
  console.log('[Scheduler] Started - Proactive scanner runs every 5 minutes, scheduled agents and email polling every minute');
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
  if (emailPollJob) {
    emailPollJob.stop();
    emailPollJob = null;
  }
  isRunning = false;
  console.log('[Scheduler] Stopped');
}

export function isSchedulerRunning(): boolean {
  return isRunning;
}
