import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
export default function YtRefBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("crm-yt-ref shrink-0 text-[10px]", className)}
    >
      {value}
    </Badge>
  );
}
