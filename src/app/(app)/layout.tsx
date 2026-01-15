import { AppSidebar } from '@/components/layout/app-sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
