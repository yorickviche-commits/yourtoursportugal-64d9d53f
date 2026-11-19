import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStageColor, stageLabel } from "./stageAppearance";
export default function StageBadge({
  stage,
  className,
}: {
  stage: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      title={stage}
      className={cn(getStageColor(stage), "text-[10px] max-w-full", className)}
    >
      <span className="truncate">{stageLabel(stage)}</span>
    </Badge>
  );
}
