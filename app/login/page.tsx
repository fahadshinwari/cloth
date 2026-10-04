"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/app/actions/auth.actions";

const initial: LoginActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-sm text-zinc-500">Sign in with your shop account.</p>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
