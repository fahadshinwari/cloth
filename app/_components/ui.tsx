import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${controlClass} ${className}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select {...rest} className={`${controlClass} ${className}`} />;
}

export function SubmitButton({
  children,
  pending,
  variant = "primary",
}: {
  children: ReactNode;
  pending?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900",
    secondary: "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
    danger: "bg-red-600 text-white hover:bg-red-500",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: "active" | "inactive" }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}
