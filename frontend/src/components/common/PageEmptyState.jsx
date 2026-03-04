import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * PageEmptyState - حالة عدم وجود بيانات.
 * استخدمه عند قوائم أو جداول فارغة: أيقونة + رسالة + زر إجراء اختياري.
 */
export function PageEmptyState({
  icon: Icon,
  message,
  actionLabel,
  onAction,
  className,
  dir,
}) {
  return (
    <Card
      dir={dir}
      className={cn(
        "border-dashed border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30",
        className
      )}
    >
      <CardContent className="py-12 text-center">
        {Icon && (
          <Icon className="w-14 h-14 mx-auto text-slate-400 dark:text-slate-500 mb-4" />
        )}
        <p className="text-muted-foreground mb-4">{message}</p>
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
