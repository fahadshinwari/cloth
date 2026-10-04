"use client";

import { useState } from "react";

export interface TenantNavItem {
  href: string;
  label: string;
}

/**
 * Tenant navigation: inline links from `xl` (1280px) up, burger menu below.
 * Works in both LTR and RTL since it only uses flex/flow layout.
 * The menu closes when a link is clicked or when the toggle is pressed again.
 */
export function TenantNav({ items }: { items: TenantNavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="xl:hidden" aria-label="Shop navigation">
      {/* Burger toggle — always visible on mobile/tablet. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="tenant-nav-menu"
        aria-label="Toggle navigation"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? (
            <path d="M18 6 6 18M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Full-width dropdown under the header bar. */}
      {open ? (
        <div
          id="tenant-nav-menu"
          className="absolute inset-x-0 top-full z-50 border-b border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <ul className="mx-auto flex w-full max-w-6xl flex-col px-4 py-2">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
