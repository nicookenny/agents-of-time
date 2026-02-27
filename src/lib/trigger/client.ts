const TRIGGER_API_URL = process.env.TRIGGER_API_URL || 'http://localhost:8030';
const TRIGGER_API_KEY = process.env.TRIGGER_API_KEY || '';

interface ScheduleOptions {
  id: string;
  cron: string;
  externalId?: string;
}

export async function createSchedule(options: ScheduleOptions) {
  const response = await fetch(`${TRIGGER_API_URL}/api/v1/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TRIGGER_API_KEY}`,
    },
    body: JSON.stringify({
      task: 'flow-executor',
      cron: options.cron,
      externalId: options.externalId || options.id,
      deduplicationKey: options.id,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create schedule: ${error}`);
  }

  return response.json();
}

export async function deleteSchedule(scheduleId: string) {
  const response = await fetch(`${TRIGGER_API_URL}/api/v1/schedules/${scheduleId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${TRIGGER_API_KEY}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete schedule: ${error}`);
  }

  return { success: true };
}

export async function updateSchedule(scheduleId: string, options: Partial<ScheduleOptions>) {
  const response = await fetch(`${TRIGGER_API_URL}/api/v1/schedules/${scheduleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TRIGGER_API_KEY}`,
    },
    body: JSON.stringify({
      cron: options.cron,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update schedule: ${error}`);
  }

  return response.json();
}

export function calculateNextRun(cronExpression: string): Date {
  const now = new Date();
  return new Date(now.getTime() + 60000);
}
