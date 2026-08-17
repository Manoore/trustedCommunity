import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ button */

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

const buttonSizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
} as const;

const buttonVariants = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md",
  coral: "bg-coral-500 text-white shadow-sm hover:bg-coral-600 hover:shadow-md",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-sunken hover:border-brand-300",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonSizes[size], buttonVariants[variant], className)}
      {...props}
    />
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonBase, buttonSizes[size], buttonVariants[variant], className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------- inputs */

const fieldBase =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  errors,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  children: ReactNode;
}) {
  const errorId = errors?.length ? `${htmlFor}-error` : undefined;
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      <div aria-describedby={cn(hintId, errorId) || undefined}>{children}</div>
      {errors?.length ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- containers */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-surface-sunken text-ink-muted",
  brand: "bg-brand-50 text-brand-700",
  coral: "bg-coral-100 text-coral-700",
  gold: "bg-gold-100 text-gold-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  featured: "bg-gold-500 text-white shadow-sm",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "border-brand-200 bg-brand-50 text-brand-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-sm", tones[tone])}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  emoji = "✨",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  emoji?: string;
}) {
  return (
    <div className="warm-wash rounded-2xl border border-dashed border-line-strong bg-surface p-12 text-center">
      <div
        aria-hidden="true"
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-sunken text-2xl"
      >
        {emoji}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {description && (
        <div className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{description}</div>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- avatar */

/**
 * Initials on a colour derived from the name. Gives every contact a face in a
 * list without needing a single uploaded image.
 */
export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
  };

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl font-bold tracking-wide text-white",
        sizes[size],
      )}
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

/** A small coloured dot, used to key a category in dense lists. */
export function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/* ---------------------------------------------------------------- rating */

export function Stars({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span
        className="text-gold-400"
        aria-label={`${value.toFixed(1)} out of 5 stars`}
      >
        {"★★★★★".slice(0, Math.floor(rounded))}
        <span className="text-line-strong">
          {"★★★★★".slice(0, 5 - Math.floor(rounded))}
        </span>
      </span>
      <span className="text-ink-muted">
        {value > 0 ? value.toFixed(1) : "New"}
        {count ? ` (${count})` : ""}
      </span>
    </span>
  );
}
