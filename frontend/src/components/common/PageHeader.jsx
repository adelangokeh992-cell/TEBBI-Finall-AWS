import React from "react";
import { cn } from "@/lib/utils";

/**
 * PageHeader - منطقة علوية موحّدة لكل صفحة.
 * استخدمه في بداية كل صفحة داخلية لعنوان ووصف وأزرار وبادج حالة.
 * يدعم RTL و dir وخلفية متدرجة اختيارية.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  badge,
  className,
  dir,
  gradient = false,
}) {
  return (
    <div
      dir={dir}
      className={cn(
        "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",
        gradient &&
          "rounded-2xl border border-teal-200/60 dark:border-teal-800/60 bg-gradient-to-br from-teal-50/80 to-purple-50/50 dark:from-teal-950/30 dark:to-purple-950/20 p-6",
        className
      )}
    >
      <div className="flex-1 min-w-0">
        {badge && <div className="flex flex-wrap items-center gap-2 mb-2">{badge}</div>}
        <h1
          className={cn(
            "text-3xl font-bold flex items-center gap-3",
            gradient ? "text-teal-800 dark:text-teal-100" : "text-slate-800 dark:text-white"
          )}
        >
          {Icon && <Icon className="w-10 h-10 text-teal-600 dark:text-teal-400 shrink-0" />}
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
