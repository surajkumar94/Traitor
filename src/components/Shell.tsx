import type { ReactNode } from 'react';

interface ShellProps {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Shell({ eyebrow, title, children, footer }: ShellProps) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-7">
      {(eyebrow || title) && (
        <header className="mb-5 text-center">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {title && <h1 className="display mt-2 text-2xl leading-tight text-parchment">{title}</h1>}
        </header>
      )}
      <main className="flex flex-1 flex-col">{children}</main>
      {footer && <footer className="mt-6">{footer}</footer>}
    </div>
  );
}
