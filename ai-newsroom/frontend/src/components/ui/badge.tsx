import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
        ai: "bg-violet-50 text-violet-700",
        tech: "bg-blue-50 text-blue-700",
        business: "bg-emerald-50 text-emerald-700",
        policy: "bg-amber-50 text-amber-700",
        science: "bg-cyan-50 text-cyan-700",
        security: "bg-red-50 text-red-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

function CategoryBadge({ category }: { category: string | null }) {
  const variantMap: Record<string, "ai" | "tech" | "business" | "policy" | "science" | "security" | "secondary"> = {
    AI: "ai",
    Tech: "tech",
    Business: "business",
    Policy: "policy",
    Science: "science",
    Security: "security",
  };
  return (
    <Badge variant={variantMap[category || ""] || "secondary"}>
      {category || "Other"}
    </Badge>
  );
}

export { Badge, CategoryBadge, badgeVariants };
