'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Bot } from 'lucide-react';
import { ChatMessage } from '@/components/chat/chat-message';
import { ChatInput } from '@/components/chat/chat-input';
import { ConversationList } from '@/components/chat/conversation-list';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  description: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: { toolName: string; args: unknown; toolCallId: string }[];
  toolResults?: { toolCallId: string; result: unknown }[];
}

type ChatMetadata = { conversationId?: string };
type ChatUIMessage = UIMessage<ChatMetadata>;

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: agentId } = use(params);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
  } = useChat<ChatUIMessage>({
    transport: new DefaultChatTransport({
      api: `/api/agents/${agentId}/chat`,
      body: { conversationId: selectedConversationId },
    }),
    onFinish: ({ message }) => {
      const convId = message.metadata?.conversationId;
      if (convId && !selectedConversationId) {
        setSelectedConversationId(convId);
        fetchConversations();
      }
    },
  });

  const isChatLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    const fetchAgent = async () => {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data);
      }
      setIsLoadingAgent(false);
    };
    fetchAgent();
  }, [agentId]);

  const fetchConversations = useCallback(async () => {
    const res = await fetch(`/api/agents/${agentId}/conversations`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
    setIsLoadingConversations(false);
  }, [agentId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    const res = await fetch(`/api/agents/${agentId}/conversations/${conversationId}`);
    if (res.ok) {
      const data = await res.json();
      const loadedMessages = data.messages.map((msg: ChatMessageData) => {
        const parts: Array<
          | { type: 'text'; text: string }
          | { type: 'tool-invocation'; toolInvocation: { toolName: string; args: unknown; state: 'result'; result: unknown } }
        > = [];

        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            parts.push({
              type: 'tool-invocation',
              toolInvocation: {
                toolName: tc.toolName,
                args: tc.args,
                state: 'result',
                result: msg.toolResults?.find((tr) => tr.toolCallId === tc.toolCallId)?.result,
              },
            });
          }
        }

        return { id: msg.id, role: msg.role, parts };
      });
      setMessages(loadedMessages);
    }
  };

  const startNewConversation = () => {
    setSelectedConversationId(null);
    setMessages([]);
  };

  const deleteConversation = async (conversationId: string) => {
    await fetch(`/api/agents/${agentId}/conversations/${conversationId}`, {
      method: 'DELETE',
    });
    if (selectedConversationId === conversationId) {
      startNewConversation();
    }
    fetchConversations();
  };

  const handleSend = (content: string) => {
    sendMessage({ parts: [{ type: 'text', text: content }] });
  };

  if (isLoadingAgent) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Agent not found</p>
        <Button asChild variant="outline">
          <Link href="/agents">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId || undefined}
          onSelect={loadConversation}
          onNew={startNewConversation}
          onDelete={deleteConversation}
          isLoading={isLoadingConversations}
        />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b p-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/agents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Bot className="h-5 w-5 text-purple-600" />
          <div>
            <h1 className="font-semibold">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">Chat</p>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                Start a conversation with {agent.name}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {agent.description}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message as any}
                  agentName={agent.name}
                />
              ))}
              {isChatLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {agent.name} is thinking...
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <ChatInput onSend={handleSend} isLoading={isChatLoading} />
      </div>
    </div>
  );
}
