import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * DataCard - بطاقة محتوى قياسية للقوائم/الجداول.
 * حدود أوضح، rounded-xl، hover للعناصر القابلة للنقر.
 * استخدمه كغلاف لأي قسم محتوى (جدول، قائمة، نموذج).
 */
export function DataCard({
  title,
  description,
  children,
  className,
  clickable,
  hoverBorderColor = "teal",
  ...props
}) {
  const hoverBorderClass =
    hoverBorderColor === "teal"
      ? "hover:border-teal-300"
      : hoverBorderColor === "blue"
      ? "hover:border-blue-300"
      : hoverBorderColor === "purple"
      ? "hover:border-purple-300"
      : "hover:border-slate-300";

  return (
    <Card
      className={cn(
        "rounded-xl border-2 transition-all duration-200",
        clickable && "cursor-pointer hover:shadow-xl hover:scale-[1.01] " + hoverBorderClass,
        className
      )}
      {...props}
    >
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      {children && <CardContent className={title || description ? undefined : "p-6"}>{children}</CardContent>}
    </Card>
  );
}
