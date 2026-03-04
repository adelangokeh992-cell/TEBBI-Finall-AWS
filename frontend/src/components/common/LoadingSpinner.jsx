import React from "react";
import { cn } from "@/lib/utils";

/**
 * LoadingSpinner - مؤشر تحميل موحد في كل الصفحات.
 */
export function LoadingSpinner({ className, size = "md" }) {
  const sizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <div className={cn("flex items-center justify-center min-h-[12rem]", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-teal-600",
          sizeClass
        )}
      />
    </div>
  );
}
