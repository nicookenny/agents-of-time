'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Workflow,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Loader2,
  Clock,
  Bot,
  AlertTriangle,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FlowData {
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  actionDescription: string;
  status: 'active' | 'paused' | 'error';
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  agentId: string;
  agent: { id: string; name: string } | null;
}

interface TriggerStatus {
  configured: boolean;
  apiKeySet: boolean;
  apiUrl: string;
}

const STATUS_COLORS = {
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  error: 'bg-red-500',
};

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFlows();
    fetchTriggerStatus();
  }, []);

  async function fetchFlows() {
    try {
      const res = await fetch('/api/flows');
      if (res.ok) {
        const data = await res.json();
        setFlows(data);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTriggerStatus() {
    try {
      const res = await fetch('/api/trigger/status');
      if (res.ok) setTriggerStatus(await res.json());
    } catch {
      console.error('Failed to fetch trigger status');
    }
  }

  async function toggleFlowStatus(flow: FlowData) {
    const newStatus = flow.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/agents/${flow.agentId}/flows/${flow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setFlows((prev) =>
          prev.map((f) => (f.id === flow.id ? { ...f, status: newStatus } : f))
        );
      }
    } catch {
      console.error('Failed to toggle flow status');
    }
  }

  async function deleteFlow(flow: FlowData) {
    if (!confirm('Are you sure you want to delete this flow?')) return;

    try {
      const res = await fetch(`/api/agents/${flow.agentId}/flows/${flow.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      }
    } catch {
      console.error('Failed to delete flow');
    }
  }

  async function triggerFlow(flow: FlowData) {
    try {
      await fetch('/api/flows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId: flow.id }),
      });
      fetchFlows();
    } catch {
      console.error('Failed to trigger flow');
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const triggerConfigured = triggerStatus?.configured ?? false;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flows</h1>
          <p className="text-muted-foreground">
            Automate your agents with scheduled flows
          </p>
        </div>
        {triggerConfigured ? (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-1.5" />
            Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <AlertTriangle className="h-3 w-3 mr-1.5" />
            Offline
          </Badge>
        )}
      </div>

      {!triggerConfigured && (
        <div className="p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-yellow-600">Trigger.dev not configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Flows won&apos;t run automatically until Trigger.dev is set up. You can still view and manually run flows.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure in Settings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 rounded-md bg-muted/50 border">
        <p className="text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4 inline mr-1.5 -mt-0.5" />
          Create flows by chatting with an agent. Ask your agent to set up automated tasks and schedules.
        </p>
      </div>

      {flows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Workflow className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{flow.name}</CardTitle>
                      {flow.agent && (
                        <Link
                          href={`/agents/${flow.agent.id}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                        >
                          <Bot className="h-3 w-3" />
                          {flow.agent.name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => triggerFlow(flow)}>
                        <Play className="mr-2 h-4 w-4" />
                        Run Now
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleFlowStatus(flow)}>
                        {flow.status === 'active' ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteFlow(flow)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {flow.description || flow.actionDescription}
                </p>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <code className="text-xs text-muted-foreground">{flow.schedule}</code>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[flow.status]}`} />
                    <span className="capitalize">{flow.status}</span>
                    {!triggerConfigured && flow.status === 'active' && (
                      <span className="text-yellow-600">(Won&apos;t auto-run)</span>
                    )}
                  </div>
                  <span>Last run: {formatDate(flow.lastRunAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex min-h-[300px] items-center justify-center">
          <CardContent className="text-center">
            <Workflow className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No flows yet. Chat with an agent to create automated tasks.
            </p>
            <Button className="mt-4" variant="outline" asChild>
              <Link href="/agents">
                <Bot className="mr-2 h-4 w-4" />
                View Agents
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
