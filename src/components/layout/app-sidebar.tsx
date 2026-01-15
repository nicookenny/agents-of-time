'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Link2,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const navigation = [
  { name: 'Feed', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Accounts', href: '/accounts', icon: Link2 },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Zap className="h-6 w-6 text-primary" />
        <span className="font-semibold">Agents of Life</span>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Button
                key={item.name}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3',
                  isActive && 'bg-secondary'
                )}
                asChild
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}
