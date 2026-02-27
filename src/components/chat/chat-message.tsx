'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Bot, User, Wrench } from 'lucide-react';

interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation: {
    toolName: string;
    args: unknown;
    state: 'partial-call' | 'call' | 'result';
    result?: unknown;
  };
}

interface TextPart {
  type: 'text';
  text: string;
}

type MessagePart = TextPart | ToolInvocationPart | { type: string };

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  parts?: MessagePart[];
  content?: string;
}

interface ChatMessageProps {
  message: ChatMessage;
  agentName?: string;
}

export function ChatMessage({ message, agentName }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const textContent = message.parts
    ?.filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('') || message.content || '';

  const toolParts = message.parts?.filter(
    (part): part is ToolInvocationPart => part.type === 'tool-invocation'
  ) || [];

  return (
    <div
      className={cn(
        'flex gap-3 py-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-white text-xs',
            isUser ? 'bg-blue-600' : 'bg-purple-600'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          'flex flex-col gap-2 max-w-[80%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <span className="text-xs text-muted-foreground">
          {isUser ? 'You' : agentName || 'Assistant'}
        </span>

        {textContent && (
          <Card
            className={cn(
              'px-4 py-3',
              isUser
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-muted/50'
            )}
          >
            <p className="text-sm whitespace-pre-wrap">{textContent}</p>
          </Card>
        )}

        {toolParts.map((part, i) => (
          <Card key={i} className="px-4 py-3 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-700">
                {part.toolInvocation.toolName}
              </span>
              {part.toolInvocation.state === 'result' && (
                <span className="text-green-600 text-xs">✓ completed</span>
              )}
            </div>
            {part.toolInvocation.state === 'result' && part.toolInvocation.result != null && (
              <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-32">
                {typeof part.toolInvocation.result === 'string'
                  ? part.toolInvocation.result
                  : JSON.stringify(part.toolInvocation.result, null, 2)}
              </pre>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
