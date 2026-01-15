'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, Mail, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ActionCard } from '@/components/feed/action-card';
import { FeedItem } from '@/components/feed/feed-item';

interface FeedItemData {
  id: string;
  itemType: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
  agent: { id: string; name: string } | null;
  proposedAction?: Record<string, unknown>;
}

const AGENT_COLORS: Record<string, string> = {
  'Email Assistant': '#7c3aed',
  'Calendar Bot': '#059669',
  'Calendar Manager': '#059669',
  'Blog Writer': '#dc2626',
  'Code Assistant': '#0891b2',
  'Content Writer': '#f59e0b',
  'File Manager': '#6366f1',
  'Custom Agent': '#8b5cf6',
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

export default function DashboardPage() {
  const [actionItems, setActionItems] = useState<FeedItemData[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();

      setActionItems(data.actionRequired || []);
      setFeedItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch feed:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchFeed();
  };

  const handleApprove = async (id: string, response?: string) => {
    try {
      await fetch(`/api/feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', reason: response }),
      });
      setActionItems((items) => items.filter((item) => item.id !== id));
      fetchFeed();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      await fetch(`/api/feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      });
      setActionItems((items) => items.filter((item) => item.id !== id));
      fetchFeed();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      setFeedItems((items) => items.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  };

  const actionRequiredCount = actionItems.length;
  const unreadCount = feedItems.filter(
    (item) => item.status === 'pending' || item.status === 'pending_approval'
  ).length;

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
        <h1 className="text-3xl font-bold">Feed</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-amber-500">Action Required</span>
            <Badge variant="secondary">{actionRequiredCount}</Badge>
          </div>
          {actionRequiredCount > 3 && (
            <Button variant="link" className="gap-1 text-sm">
              View All
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        {actionRequiredCount > 0 ? (
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {actionItems.map((item) => {
                const agentName = item.agent?.name || 'Unknown Agent';
                return (
                  <ActionCard
                    key={item.id}
                    id={item.id}
                    agentName={agentName}
                    agentInitials={getAgentInitials(agentName)}
                    agentColor={getAgentColor(agentName)}
                    type={
                      item.itemType === 'approval_request' ? 'approval' : 'question'
                    }
                    title={item.title}
                    description={item.description || 'Action needed'}
                    onRespond={(id, response) => handleApprove(id, response)}
                    onViewDetails={(id) => console.log('View details:', id)}
                  />
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No actions required
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <span className="font-medium">Messages</span>
          <Badge variant="secondary">{feedItems.length}</Badge>
        </div>
        {feedItems.length > 0 ? (
          <div className="flex flex-col gap-3">
            {feedItems.map((item) => {
              const agentName = item.agent?.name || 'Unknown Agent';
              return (
                <FeedItem
                  key={item.id}
                  id={item.id}
                  agentName={agentName}
                  agentInitials={getAgentInitials(agentName)}
                  agentColor={getAgentColor(agentName)}
                  content={item.description || item.title}
                  timestamp={new Date(item.createdAt)}
                  isRead={item.status === 'completed' || item.status === 'dismissed'}
                  onReply={(id) => console.log('Reply to:', id)}
                  onOpen={(id) => console.log('Open:', id)}
                  onMarkRead={(id) => handleDismiss(id)}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No messages yet. Your agents will post updates here.
          </div>
        )}
      </section>
    </div>
  );
}
