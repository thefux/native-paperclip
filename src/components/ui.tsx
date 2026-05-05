
import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}>(function Button({ className, variant = "primary", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-accent text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent",
        variant === "ghost" && "text-fg hover:bg-surface border border-border",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm",
          "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface p-4", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  children,
  tone = "neutral",
}: {
  className?: string;
  children: React.ReactNode;
  tone?: "neutral" | "info" | "warn" | "danger" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-border/40 text-fg",
        tone === "info" && "bg-blue-500/15 text-blue-300",
        tone === "warn" && "bg-yellow-500/15 text-yellow-300",
        tone === "danger" && "bg-red-500/15 text-red-300",
        tone === "success" && "bg-green-500/15 text-green-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
