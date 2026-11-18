"use client";

/**
 * Prints either the whole page or a single marked section.
 * When `targetId` is given, every sibling along the target's ancestor chain
 * is temporarily hidden so only that section (and its headings) prints.
 * `header`, `nav` and `.no-print` are hidden by the print stylesheet.
 */
export function PrintButton({
  targetId,
  label = "Print",
}: {
  targetId?: string;
  label?: string;
}) {
  const handlePrint = () => {
    const hidden: HTMLElement[] = [];
    const target = targetId ? document.getElementById(targetId) : null;

    if (target) {
      const root = target.closest("main") ?? document.body;
      let node: HTMLElement | null = target;

      while (node && node !== root) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) break;
        for (const sibling of Array.from(parent.children)) {
          if (sibling !== node && sibling instanceof HTMLElement) {
            sibling.classList.add("print-hidden");
            hidden.push(sibling);
          }
        }
        if (parent === root) break;
        node = parent;
      }
    }

    try {
      window.print();
    } finally {
      for (const element of hidden) element.classList.remove("print-hidden");
    }
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex h-9 items-center rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 print:hidden dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}
