"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/app/actions/auth.actions";
import { useI18n } from "../../_components/i18n-provider";

const initial: LoginActionState = {};

export function ShopLoginForm({ slug, shopName }: { slug: string; shopName: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(loginAction, initial);

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
      <div>
        <p className="text-sm font-medium">{shopName}</p>
        <p className="text-sm text-zinc-500" dir="ltr">
          /{slug}
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="shopSlug" value={slug} />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("login.email")}</span>
          <input name="email" type="email" required autoComplete="email" dir="ltr" className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("login.password")}</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            dir="ltr"
            className={inputClass}
          />
        </label>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : t("login.submit")}
        </button>
      </form>
    </main>
  );
}
