import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const colorMap = {
  teal: "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
  blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
  green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
};

/**
 * StatCard - بطاقة إحصائية صغيرة (عنوان، قيمة، أيقونة).
 * استخدمه في لوحة التحكم وصفحات الملخص.
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  color = "teal",
  className,
}) {
  const iconClass = colorMap[color] || colorMap.teal;
  return (
    <Card
      className={cn(
        "rounded-xl border-2 hover:shadow-lg transition-all duration-200",
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
          {Icon && (
            <div className={cn("p-3 rounded-xl", iconClass)}>
              <Icon className="w-6 h-6" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
