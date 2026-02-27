'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Bot,
  MoreVertical,
  Play,
  Pause,
  Settings,
  Trash2,
  Loader2,
  Zap,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  isActive: boolean;
  requiresApproval: boolean;
  lastRunAt: string | null;
  createdAt: string;
  model: { id: string; name: string; modelIdentifier: string } | null;
  tools: { id: string; name: string; identifier: string }[];
}

const AGENT_COLORS: Record<string, string> = {
  'Email Assistant': '#7c3aed',
  'Calendar Bot': '#059669',
  'Calendar Manager': '#059669',
  'Blog Writer': '#dc2626',
  'Code Assistant': '#0891b2',
  'Content Writer': '#f59e0b',
  'File Manager': '#6366f1',
};

function getAgentColor(name: string): string {
  return AGENT_COLORS[name] || '#8b5cf6';
}

function getAgentInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const toggleAgentStatus = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === id ? { ...agent, isActive: !currentStatus } : agent
        )
      );
    } catch (err) {
      console.error('Failed to toggle agent status:', err);
    }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      setAgents((prev) => prev.filter((agent) => agent.id !== id));
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  const runAgent = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}/run`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        fetchAgents();
      }
    } catch (err) {
      console.error('Failed to run agent:', err);
    }
  };

  const formatLastRun = (dateStr: string | null) => {
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
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground">
            Create and manage your AI agents
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/new">
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Link>
        </Button>
      </div>

      {agents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.id}`} className="block">
              <Card className="relative cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback
                          className="text-sm font-medium text-white"
                          style={{ backgroundColor: getAgentColor(agent.name) }}
                        >
                          {getAgentInitials(agent.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {agent.model?.name || 'No model'}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                      <DropdownMenuItem asChild>
                        <Link href={`/agents/${agent.id}/chat`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Chat
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => runAgent(agent.id)}>
                        <Zap className="mr-2 h-4 w-4" />
                        Run Now
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/agents/${agent.id}`}>
                          <Settings className="mr-2 h-4 w-4" />
                          Configure
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toggleAgentStatus(agent.id, agent.isActive)}
                      >
                        {agent.isActive ? (
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
                        onClick={() => deleteAgent(agent.id)}
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
                  {agent.description || 'No description'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.map((tool) => (
                    <Badge key={tool.id} variant="outline" className="text-xs">
                      {tool.name}
                    </Badge>
                  ))}
                  {agent.tools.length === 0 && (
                    <span className="text-xs text-muted-foreground">No tools</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        agent.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                      }`}
                    />
                    {agent.isActive ? 'Active' : 'Paused'}
                  </div>
                  <span>Last run: {formatLastRun(agent.lastRunAt)}</span>
                </div>
              </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="flex min-h-[300px] items-center justify-center">
          <CardContent className="text-center">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No agents yet. Create your first agent to get started.
            </p>
            <Button asChild className="mt-4">
              <Link href="/agents/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
