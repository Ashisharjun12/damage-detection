import { Link, Outlet, useLocation } from 'react-router-dom';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', label: 'Upload' },
  { to: '/surveys', label: 'History' },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              M-02 Damage Detection
            </Link>
            <nav className="flex gap-1">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'inline-flex h-8 items-center rounded-4xl px-3 text-sm font-medium transition-colors hover:bg-muted',
                    (item.to === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.to)) &&
                      'bg-muted text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
