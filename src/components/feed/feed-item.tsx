'use client';

import { formatDistanceToNow, format } from 'date-fns';
import { MessageCircle, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface FeedItemProps {
  id: string;
  agentName: string;
  agentInitials: string;
  agentColor: string;
  content: string;
  timestamp: Date;
  isRead?: boolean;
  onReply?: (id: string) => void;
  onOpen?: (id: string) => void;
  onMarkRead?: (id: string) => void;
}

export function FeedItem({
  id,
  agentName,
  agentInitials,
  agentColor,
  content,
  timestamp,
  isRead = false,
  onReply,
  onOpen,
  onMarkRead,
}: FeedItemProps) {
  const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });
  const exactTime = format(timestamp, 'MMM d, h:mm a');

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        !isRead && 'border-l-2 border-l-primary bg-muted/30'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className="text-xs font-medium text-white"
              style={{ backgroundColor: agentColor }}
            >
              {agentInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{agentName}</span>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            <p className="text-sm text-foreground/90">{content}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isRead ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onReply?.(id)}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Reply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onOpen?.(id)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Button>
          {!isRead && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => onMarkRead?.(id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Read
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{exactTime}</span>
      </div>
    </div>
  );
}
