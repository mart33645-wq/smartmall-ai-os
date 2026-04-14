import type { ReactNode } from 'react';

import Sidebar from './Sidebar';

interface AppShellProps {
  children: ReactNode;
  onLogout?: () => void;
  mainClassName?: string;
}

export const AppShell = ({ children, onLogout, mainClassName = '' }: AppShellProps) => (
  <div className="min-h-screen bg-[#050505] text-white md:flex">
    <Sidebar onLogout={onLogout} />
    <main className={`min-w-0 flex-1 p-4 md:p-8 overflow-y-auto ${mainClassName}`.trim()}>
      {children}
    </main>
  </div>
);
