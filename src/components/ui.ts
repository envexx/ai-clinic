const focusRing =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

export const inputClass =
  `flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const labelClass =
  "flex flex-col gap-1.5 text-xs font-medium text-muted-foreground";

export const primaryButtonClass =
  `inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

export const secondaryButtonClass =
  `inline-flex items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

export const dangerButtonClass =
  `inline-flex items-center justify-center gap-2 rounded-md border border-destructive/30 bg-background px-4 py-2 text-sm font-medium text-destructive shadow-xs transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

export const cardClass =
  "rounded-xl border bg-card p-6 text-card-foreground shadow-sm";

export const errorClass =
  "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive";

export const successClass =
  "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400";
