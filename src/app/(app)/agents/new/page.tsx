'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Bot, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { generateAgentConfig, createAgent, type AgentConfig } from './actions';

const examplePrompts = [
  'Create an email assistant that categorizes incoming emails and drafts responses for routine inquiries',
  'Build a calendar manager that sends meeting reminders and detects scheduling conflicts',
  'Make a code reviewer that runs linting checks and suggests improvements',
];

export default function NewAgentPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedAgent, setGeneratedAgent] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const config = await generateAgentConfig(prompt);
      setGeneratedAgent(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate agent');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!generatedAgent) return;

    setIsCreating(true);
    setError(null);

    try {
      await createAgent(generatedAgent);
      router.push('/agents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Agent</h1>
          <p className="text-muted-foreground">
            Describe your agent in natural language
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5" />
                Describe Your Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe what you want your agent to do..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[150px] resize-none"
              />
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Agent
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Example Prompts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {examplePrompts.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(example)}
                  className="w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted"
                >
                  {example}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          {generatedAgent ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5" />
                  Generated Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <p className="mt-1 text-lg font-semibold">
                    {generatedAgent.name}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {generatedAgent.description}
                  </p>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium">Selected Model</label>
                  <Badge variant="secondary" className="mt-1.5 block w-fit">
                    Claude Haiku 3.5
                  </Badge>
                </div>

                <div>
                  <label className="text-sm font-medium">Tools</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {generatedAgent.tools.map((tool) => (
                      <Badge key={tool} variant="outline">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium">System Prompt</label>
                  <div className="mt-1.5 rounded-lg bg-muted p-3">
                    <pre className="whitespace-pre-wrap text-xs">
                      {generatedAgent.systemPrompt}
                    </pre>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Agent'
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex h-full min-h-[400px] items-center justify-center">
              <CardContent className="text-center">
                <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Describe your agent and click Generate to preview
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
