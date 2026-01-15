'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Mail, Calendar, Trash2, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ConnectedAccount {
  id: string;
  accountEmail: string | null;
  accountName: string | null;
  scopesGranted: string[] | null;
  isActive: boolean;
  createdAt: string;
  provider: {
    id: string;
    name: string;
  } | null;
}

const availableServices = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, send, and manage emails',
    icon: Mail,
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Access and manage calendar events',
    icon: Calendar,
  },
];

function getServicesFromScopes(scopes: string[] | null): string[] {
  if (!scopes) return [];
  const services: string[] = [];
  if (scopes.some(s => s.includes('gmail'))) services.push('Gmail');
  if (scopes.some(s => s.includes('calendar'))) services.push('Calendar');
  return services;
}

function AccountsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const success = searchParams.get('success');
  const error = searchParams.get('error');

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleConnect = (serviceId: string) => {
    setDialogOpen(false);
    window.location.href = `/api/oauth/connect?service=${serviceId}`;
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (res.ok) {
        setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleReauth = (serviceId: string) => {
    window.location.href = `/api/oauth/connect?service=${serviceId}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connected Accounts</h1>
          <p className="text-muted-foreground">
            Manage your OAuth connections for Gmail and Calendar
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect a new account</DialogTitle>
              <DialogDescription>
                Choose a service to connect. You can connect multiple accounts
                from the same provider.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {availableServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleConnect(service.id)}
                  className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted"
                >
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <service.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(success || error) && (
        <div className={`rounded-lg p-4 ${success ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive'}`}>
          {success === 'gmail_connected' && 'Gmail account connected successfully!'}
          {success === 'calendar_connected' && 'Calendar account connected successfully!'}
          {success === 'connected' && 'Account connected successfully!'}
          {error && `Error: ${error}`}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => {
          const services = getServicesFromScopes(account.scopesGranted);
          return (
            <Card key={account.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {(account.accountName || account.accountEmail || 'U')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {account.accountName || 'Google Account'}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {account.accountEmail}
                      </p>
                    </div>
                  </div>
                  {account.isActive ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      Needs Reauth
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {services.map((service) => (
                    <Badge key={service} variant="secondary" className="text-xs">
                      {service}
                    </Badge>
                  ))}
                  {services.length === 0 && (
                    <Badge variant="outline" className="text-xs">
                      No services
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Connected {formatDate(account.createdAt)}
                </p>
                <div className="flex gap-2">
                  {!account.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleReauth('gmail')}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Reconnect
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDisconnect(account.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <Card className="flex min-h-[300px] items-center justify-center">
          <CardContent className="text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No accounts connected yet. Connect your first account to get started.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect a new account</DialogTitle>
                  <DialogDescription>
                    Choose a service to connect.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  {availableServices.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleConnect(service.id)}
                      className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted"
                    >
                      <div className="rounded-lg bg-primary/10 p-2.5">
                        <service.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <AccountsContent />
    </Suspense>
  );
}
