import { ArrowDown, ArrowDownToLine, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PriceLevel } from "@/lib/pricing";

// Each level has a color, an icon and a label, so the meaning never depends on color alone
export const LEVELS: Record<PriceLevel, { label: string; color: string; icon: typeof ArrowDown }> = {
    negative: { label: "Negatief", color: "var(--level-negative)", icon: ArrowDownToLine },
    cheap: { label: "Goedkoop", color: "var(--level-cheap)", icon: ArrowDown },
    normal: { label: "Gemiddeld", color: "var(--level-normal)", icon: Minus },
    expensive: { label: "Duur", color: "var(--level-expensive)", icon: ArrowUp },
};

export function LevelBadge({ level, className }: { level: PriceLevel; className?: string })
{
    const { label, color, icon: Icon } = LEVELS[level];
    return (
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", className)}>
            <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
            <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            {label}
        </span>
    );
}

export function LevelLegend({ levels = ["negative", "cheap", "normal", "expensive"] }: { levels?: PriceLevel[] })
{
    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {levels.map((level) => (
                <li key={level} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm" style={{ background: LEVELS[level].color }} aria-hidden />
                    {LEVELS[level].label}
                </li>
            ))}
        </ul>
    );
}
