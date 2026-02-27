import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { flows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getToolContext } from './context';
import { createSchedule, deleteSchedule, updateSchedule } from '@/lib/trigger/client';

interface FlowToolContext {
  agentId?: string;
  userId?: string;
}

export const flowTools = {
  createFlow: tool({
    description: 'Create a new scheduled flow (recurring automation). Use cron syntax for the schedule.',
    inputSchema: z.object({
      name: z.string().describe('A short name for this flow'),
      schedule: z.string().describe('Cron expression for when to run (e.g., "0 8 * * *" for daily at 8am, "0 9 * * 1-5" for weekdays at 9am)'),
      actionDescription: z.string().describe('What actions should be performed when this flow runs'),
    }),
    execute: async ({ name, schedule, actionDescription }) => {
      const context = getToolContext<FlowToolContext>();
      if (!context.agentId) {
        return { success: false, error: 'No agent context available' };
      }

      const [flow] = await db
        .insert(flows)
        .values({
          agentId: context.agentId,
          userId: context.userId,
          name,
          schedule,
          actionDescription,
          status: 'active',
        })
        .returning();

      try {
        const triggerJob = await createSchedule({
          id: flow.id,
          cron: schedule,
          externalId: flow.id,
        });

        await db
          .update(flows)
          .set({ triggerJobId: triggerJob.id })
          .where(eq(flows.id, flow.id));

        flow.triggerJobId = triggerJob.id;
      } catch (error) {
        console.error('Failed to register flow with Trigger.dev:', error);
      }

      return {
        success: true,
        flow: {
          id: flow.id,
          name: flow.name,
          schedule: flow.schedule,
          actionDescription: flow.actionDescription,
          status: flow.status,
        },
        message: `Flow "${name}" created successfully. It will run on schedule: ${schedule}`,
      };
    },
  }),

  listFlows: tool({
    description: 'List all flows (scheduled automations) for this agent',
    inputSchema: z.object({
      _placeholder: z.boolean().optional().describe('Unused parameter'),
    }),
    execute: async () => {
      const context = getToolContext<FlowToolContext>();
      if (!context.agentId) {
        return { success: false, error: 'No agent context available' };
      }

      const agentFlows = await db
        .select({
          id: flows.id,
          name: flows.name,
          schedule: flows.schedule,
          actionDescription: flows.actionDescription,
          status: flows.status,
          lastRunAt: flows.lastRunAt,
          createdAt: flows.createdAt,
        })
        .from(flows)
        .where(eq(flows.agentId, context.agentId));

      return {
        success: true,
        flows: agentFlows,
        count: agentFlows.length,
      };
    },
  }),

  updateFlow: tool({
    description: 'Update an existing flow',
    inputSchema: z.object({
      flowId: z.string().uuid().describe('The ID of the flow to update'),
      name: z.string().optional().describe('New name for the flow'),
      schedule: z.string().optional().describe('New cron schedule'),
      actionDescription: z.string().optional().describe('New action description'),
      isActive: z.boolean().optional().describe('Whether the flow should be active or paused'),
    }),
    execute: async ({ flowId, name, schedule, actionDescription, isActive }) => {
      const context = getToolContext<FlowToolContext>();
      if (!context.agentId) {
        return { success: false, error: 'No agent context available' };
      }

      const [existing] = await db
        .select()
        .from(flows)
        .where(and(eq(flows.id, flowId), eq(flows.agentId, context.agentId)))
        .limit(1);

      if (!existing) {
        return { success: false, error: 'Flow not found or not owned by this agent' };
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (schedule !== undefined) updates.schedule = schedule;
      if (actionDescription !== undefined) updates.actionDescription = actionDescription;
      if (isActive !== undefined) updates.status = isActive ? 'active' : 'paused';

      const [updated] = await db
        .update(flows)
        .set(updates)
        .where(eq(flows.id, flowId))
        .returning();

      if (schedule !== undefined && existing.triggerJobId) {
        try {
          await updateSchedule(existing.triggerJobId, { cron: schedule });
        } catch (error) {
          console.error('Failed to update Trigger.dev schedule:', error);
        }
      }

      return {
        success: true,
        flow: {
          id: updated.id,
          name: updated.name,
          schedule: updated.schedule,
          actionDescription: updated.actionDescription,
          status: updated.status,
        },
        message: `Flow "${updated.name}" updated successfully`,
      };
    },
  }),

  deleteFlow: tool({
    description: 'Delete a flow permanently',
    inputSchema: z.object({
      flowId: z.string().uuid().describe('The ID of the flow to delete'),
    }),
    execute: async ({ flowId }) => {
      const context = getToolContext<FlowToolContext>();
      if (!context.agentId) {
        return { success: false, error: 'No agent context available' };
      }

      const [existing] = await db
        .select()
        .from(flows)
        .where(and(eq(flows.id, flowId), eq(flows.agentId, context.agentId)))
        .limit(1);

      if (!existing) {
        return { success: false, error: 'Flow not found or not owned by this agent' };
      }

      if (existing.triggerJobId) {
        try {
          await deleteSchedule(existing.triggerJobId);
        } catch (error) {
          console.error('Failed to delete Trigger.dev schedule:', error);
        }
      }

      await db.delete(flows).where(eq(flows.id, flowId));

      return {
        success: true,
        deletedId: flowId,
        message: `Flow "${existing.name}" deleted successfully`,
      };
    },
  }),
};
