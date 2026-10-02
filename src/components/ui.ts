const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export const inputClass =
  `w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const labelClass =
  "flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-muted";

export const primaryButtonClass =
  `inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const secondaryButtonClass =
  `inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const dangerButtonClass =
  `inline-flex items-center justify-center rounded-lg border border-danger/40 bg-surface px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const cardClass =
  "rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(22,33,30,0.05),0_18px_40px_-28px_rgba(22,33,30,0.35)]";

export const errorClass =
  "rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger";

export const successClass =
  "rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success";
