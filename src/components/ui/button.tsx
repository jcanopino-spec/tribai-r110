import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type Variant = "primary" | "ghost" | "outline";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50",
  ghost: "hover:bg-muted",
  outline:
    "border border-border-secondary hover:bg-muted disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        variants[variant],
        className,
      )}
    />
  );
}
