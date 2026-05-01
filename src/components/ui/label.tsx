import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      {...props}
      className={cn(
        "block font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground",
        className,
      )}
    />
  );
}

export function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
