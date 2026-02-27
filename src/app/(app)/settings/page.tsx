'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Link2,
  LogOut,
  Loader2,
  Settings,
  Zap,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Cloud,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSession, signOut } from '@/lib/auth-client';
import Link from 'next/link';

interface ConnectedAccount {
  id: string;
  accountEmail: string | null;
  accountName: string | null;
  isActive: boolean;
  provider: { name: string } | null;
}

interface TriggerStatus {
  configured: boolean;
  apiKeySet: boolean;
  apiUrl: string;
}

interface AISettings {
  aiProvider: 'cloud' | 'ollama';
  cloudModel: string;
  ollamaModel: string;
}

const CLOUD_MODELS = [
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Balanced)' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [triggerStatus, setTriggerStatus] = useState<TriggerStatus | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(true);
  const [aiSettings, setAiSettings] = useState<AISettings>({
    aiProvider: 'cloud',
    cloudModel: 'claude-3-5-haiku-20241022',
    ollamaModel: 'llama3.2:3b',
  });
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchTriggerStatus();
    fetchAISettings();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } finally {
      setAccountsLoading(false);
    }
  }

  async function fetchTriggerStatus() {
    try {
      const res = await fetch('/api/trigger/status');
      if (res.ok) {
        setTriggerStatus(await res.json());
      }
    } finally {
      setTriggerLoading(false);
    }
  }

  async function fetchAISettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setAiSettings(data);
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function saveAISettings() {
    setAiSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiSettings),
      });
    } finally {
      setAiSaving(false);
    }
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/sign-in');
  };

  const userInitials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={session?.user?.image || undefined} />
                <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-medium">{session?.user?.name || 'User'}</p>
                <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Name</p>
                  <p className="text-sm text-muted-foreground">
                    {session?.user?.name || 'Not set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    {session?.user?.email || 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              OAuth connections for your agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.slice(0, 3).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          account.isActive ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {account.accountName || account.provider?.name || 'Account'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {account.accountEmail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {accounts.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{accounts.length - 3} more accounts
                  </p>
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/accounts">
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Accounts
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Link2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No connected accounts
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/accounts">Connect Account</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Provider
            </CardTitle>
            <CardDescription>
              Choose AI for agent configuration generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>Provider</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAiSettings({ ...aiSettings, aiProvider: 'cloud' })}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                        aiSettings.aiProvider === 'cloud'
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/50'
                      }`}
                    >
                      <Cloud className="h-5 w-5" />
                      <div className="text-left">
                        <p className="font-medium">Cloud AI</p>
                        <p className="text-xs text-muted-foreground">Anthropic / OpenAI</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setAiSettings({ ...aiSettings, aiProvider: 'ollama' })}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                        aiSettings.aiProvider === 'ollama'
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/50'
                      }`}
                    >
                      <Server className="h-5 w-5" />
                      <div className="text-left">
                        <p className="font-medium">Local Ollama</p>
                        <p className="text-xs text-muted-foreground">Self-hosted</p>
                      </div>
                    </button>
                  </div>
                </div>

                {aiSettings.aiProvider === 'cloud' ? (
                  <div className="space-y-2">
                    <Label htmlFor="cloud-model">Cloud Model</Label>
                    <Select
                      value={aiSettings.cloudModel}
                      onValueChange={(value) => setAiSettings({ ...aiSettings, cloudModel: value })}
                    >
                      <SelectTrigger id="cloud-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOUD_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="ollama-model">Ollama Model</Label>
                    <Input
                      id="ollama-model"
                      value={aiSettings.ollamaModel}
                      onChange={(e) => setAiSettings({ ...aiSettings, ollamaModel: e.target.value })}
                      placeholder="llama3.2:3b"
                    />
                    <p className="text-xs text-muted-foreground">
                      Model must be pulled locally (e.g., ollama pull llama3.2:3b)
                    </p>
                  </div>
                )}

                <Button onClick={saveAISettings} disabled={aiSaving} className="w-full">
                  {aiSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save AI Settings'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Automations (Trigger.dev)
            </CardTitle>
            <CardDescription>
              Configure scheduled flows and automated tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {triggerLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : triggerStatus?.configured ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/20 bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-600">Connected</p>
                    <p className="text-xs text-muted-foreground">
                      Trigger.dev is configured and ready
                    </p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>API URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">{triggerStatus.apiUrl}</code></p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://trigger.dev/docs" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Documentation
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-600">Not Configured</p>
                    <p className="text-xs text-muted-foreground">
                      Flows won&apos;t run automatically
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Setup Instructions</p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Create a Trigger.dev account at <a href="https://trigger.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">trigger.dev</a></li>
                    <li>Create a new project and get your API key</li>
                    <li>Add <code className="text-xs bg-muted px-1 py-0.5 rounded">TRIGGER_API_KEY</code> to your environment variables</li>
                    <li>Restart your application</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://trigger.dev" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Trigger.dev
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://trigger.dev/docs" target="_blank" rel="noopener noreferrer">
                      View Docs
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Account actions that cannot be undone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
              <div>
                <p className="font-medium">Sign Out</p>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account on this device
                </p>
              </div>
              <Button variant="destructive" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
