"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { amsterdamDay, amsterdamDayOffset } from "@/lib/dates";
import { dayStats, describeDay } from "@/lib/insights";
import type { Slot } from "@/lib/pricing";
import type { Summary } from "@/lib/prices";

export function SummaryCard({ summary, slots, now }: { summary: Summary | null; slots: Slot[]; now: number })
{
    const tomorrow = amsterdamDayOffset(1, new Date(now));
    const today = amsterdamDay(now);

    // Without a stored summary, describe tomorrow (or today) from the prices on the page
    let text = summary?.text;
    let about = summary ? (summary.day === tomorrow ? "morgen" : "vandaag") : "";
    if (!text) {
        const stats = dayStats(slots, tomorrow) ?? dayStats(slots, today);
        if (stats) {
            about = stats.day === tomorrow ? "morgen" : "vandaag";
            text = describeDay(stats, about === "morgen" ? "Morgen" : "Vandaag");
        }
    }

    const byAi = summary && summary.model !== "template";

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-muted-foreground" aria-hidden />
                    Dagbericht {about && <span className="font-normal text-muted-foreground">· {about}</span>}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="leading-relaxed">{text ?? "Nog geen prijzen beschikbaar."}</p>
                <p className="text-xs text-muted-foreground">
                    {byAi ? "Geschreven door AI (Workers AI) op basis van de prijzen, standaard all-in prijzen." : "Automatisch samengesteld uit de prijzen."}
                </p>
            </CardContent>
        </Card>
    );
}
