'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  Bot,
  Cpu,
  Wrench,
  Clock,
  ShieldCheck,
  MessageSquare,
  Workflow,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  isActive: boolean;
  requiresApproval: boolean;
  runIntervalSeconds: number | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  model: { id: string; name: string; modelIdentifier: string } | null;
  tools: { id: string; name: string; identifier: string }[];
}

interface FlowData {
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  actionDescription: string;
  status: 'active' | 'paused' | 'error';
  lastRunAt: string | null;
  nextRunAt: string | null;
}

interface ConversationData {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
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

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 0) {
    const futureDiff = -diff;
    const futureMinutes = Math.floor(futureDiff / 60000);
    const futureHours = Math.floor(futureDiff / 3600000);
    const futureDays = Math.floor(futureDiff / 86400000);
    if (futureMinutes < 60) return `in ${futureMinutes}m`;
    if (futureHours < 24) return `in ${futureHours}h`;
    if (futureDays < 7) return `in ${futureDays}d`;
    return date.toLocaleDateString();
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function cronToHumanReadable(cron: string) {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, day, month, weekday] = parts;
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  if (day === '*' && month === '*' && weekday === '*') {
    return `Daily at ${time}`;
  }
  if (weekday !== '*' && day === '*' && month === '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[parseInt(weekday)] || weekday;
    return `${dayName} at ${time}`;
  }
  return cron;
}

export default function AgentDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [runIntervalSeconds, setRunIntervalSeconds] = useState(300);

  useEffect(() => {
    fetchAgent();
    fetchFlows();
    fetchConversations();
    fetchTriggerStatus();
  }, [id]);

  async function fetchAgent() {
    try {
      const res = await fetch(`/api/agents/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? 'Agent not found' : 'Failed to load agent');
        return;
      }
      const data = await res.json();
      setAgent(data);
      setName(data.name);
      setDescription(data.description || '');
      setSystemPrompt(data.systemPrompt);
      setIsActive(data.isActive);
      setRequiresApproval(data.requiresApproval);
      setRunIntervalSeconds(data.runIntervalSeconds || 300);
    } catch {
      setError('Failed to load agent');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchFlows() {
    try {
      const res = await fetch(`/api/agents/${id}/flows`);
      if (res.ok) setFlows(await res.json());
    } catch {
      console.error('Failed to fetch flows');
    }
  }

  async function fetchConversations() {
    try {
      const res = await fetch(`/api/agents/${id}/conversations`);
      if (res.ok) setConversations(await res.json());
    } catch {
      console.error('Failed to fetch conversations');
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

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          systemPrompt,
          isActive,
          requiresApproval,
          runIntervalSeconds,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setAgent((prev) => (prev ? { ...prev, ...updated } : null));
        router.refresh();
      }
    } catch {
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleFlowStatus(flow: FlowData) {
    const newStatus = flow.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/agents/${id}/flows/${flow.id}`, {
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
    if (!confirm('Delete this flow?')) return;

    try {
      const res = await fetch(`/api/agents/${id}/flows/${flow.id}`, {
        method: 'DELETE',
      });
      if (res.ok) setFlows((prev) => prev.filter((f) => f.id !== flow.id));
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
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6">
        <Bot className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">{error || 'Agent not found'}</p>
        <Button variant="outline" asChild>
          <Link href="/agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Link>
        </Button>
      </div>
    );
  }

  const activeFlowsCount = flows.filter((f) => f.status === 'active').length;
  const lastChat = conversations[0]?.updatedAt || null;
  const triggerConfigured = triggerStatus?.configured ?? false;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/agents">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">Agent Dashboard</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/agents/${id}/chat`}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-xl flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                  {agent.isActive ? 'Active' : 'Paused'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Flows</CardDescription>
                <CardTitle className="text-xl">{activeFlowsCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Chats</CardDescription>
                <CardTitle className="text-xl">{conversations.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last Chat</CardDescription>
                <CardTitle className="text-lg">{formatRelativeTime(lastChat)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5" />
                    Flows
                  </CardTitle>
                  <CardDescription>Automated tasks for this agent</CardDescription>
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
                <div className="mt-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-600">Trigger.dev not configured</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Flows won&apos;t run automatically until Trigger.dev is set up.
                      </p>
                      <Button variant="link" size="sm" className="h-auto p-0 mt-1" asChild>
                        <Link href="/settings">
                          <Settings className="h-3 w-3 mr-1" />
                          Configure in Settings
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {flows.length === 0 ? (
                <div className="text-center py-8">
                  <Workflow className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No flows configured. Chat with this agent to create automated tasks.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href={`/agents/${id}/chat`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Start Chat
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {flows.map((flow) => (
                    <div key={flow.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[flow.status]}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{flow.name}</p>
                            {!triggerConfigured && (
                              <span className="text-xs text-yellow-600">(Won&apos;t auto-run)</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {cronToHumanReadable(flow.schedule)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs text-muted-foreground text-right">
                          <p>Last: {formatRelativeTime(flow.lastRunAt)}</p>
                          <p>Next: {formatRelativeTime(flow.nextRunAt)}</p>
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Recent Conversations
                  </CardTitle>
                  <CardDescription>Chat history with this agent</CardDescription>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/agents/${id}/chat`}>View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No conversations yet. Start chatting with this agent.
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.slice(0, 5).map((conv) => (
                    <Link
                      key={conv.id}
                      href={`/agents/${id}/chat?conversation=${conv.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{conv.title || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(conv.updatedAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Agent name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What does this agent do?"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="systemPrompt">System Prompt</Label>
                    <Textarea
                      id="systemPrompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Instructions for the agent..."
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Behavior Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Active Status</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable this agent
                      </p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Requires Approval</Label>
                      <p className="text-sm text-muted-foreground">
                        Actions require user approval before execution
                      </p>
                    </div>
                    <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="interval">Run Interval (seconds)</Label>
                    <Input
                      id="interval"
                      type="number"
                      value={runIntervalSeconds}
                      onChange={(e) => setRunIntervalSeconds(parseInt(e.target.value) || 300)}
                      min={60}
                      step={60}
                    />
                    <p className="text-xs text-muted-foreground">
                      How often the agent runs automatically (minimum 60 seconds)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    Model
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agent.model ? (
                    <div className="space-y-1">
                      <p className="font-medium">{agent.model.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {agent.model.modelIdentifier}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No model assigned</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Tools
                  </CardTitle>
                  <CardDescription>Tools available to this agent</CardDescription>
                </CardHeader>
                <CardContent>
                  {agent.tools.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {agent.tools.map((tool) => (
                        <Badge key={tool.id} variant="secondary">
                          {tool.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tools configured</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Run</span>
                    <span>{formatDate(agent.lastRunAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(agent.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatDate(agent.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
