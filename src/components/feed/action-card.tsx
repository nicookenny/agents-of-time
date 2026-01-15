'use client';

import { useState } from 'react';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ActionCardProps {
  id: string;
  agentName: string;
  agentInitials: string;
  agentColor: string;
  type: 'question' | 'approval' | 'action';
  title: string;
  description: string;
  onRespond?: (id: string, response: string) => void;
  onViewDetails?: (id: string) => void;
}

export function ActionCard({
  id,
  agentName,
  agentInitials,
  agentColor,
  type,
  title,
  description,
  onRespond,
  onViewDetails,
}: ActionCardProps) {
  const [response, setResponse] = useState('');

  const handleSend = () => {
    if (response.trim() && onRespond) {
      onRespond(id, response);
      setResponse('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <Card className="w-72 shrink-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback
                className="text-xs font-medium text-white"
                style={{ backgroundColor: agentColor }}
              >
                {agentInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{agentName}</span>
          </div>
          <Badge variant="outline" className="gap-1 text-xs">
            <MessageCircle className="h-3 w-3" />
            {type === 'question' ? 'Question' : type === 'approval' ? 'Approval' : 'Action'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Textarea
          placeholder="Your response..."
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="flex-1"
            onClick={handleSend}
            disabled={!response.trim()}
          >
            Send
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onViewDetails?.(id)}
          >
            See Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
