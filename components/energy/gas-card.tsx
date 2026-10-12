"use client";

import { Flame, TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { amsterdamDay } from "@/lib/dates";
import { average, formatEuro, Slot } from "@/lib/pricing";
import { Stat } from "./section";

function SparkTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Slot }> })
{
    const slot = payload?.[0]?.payload;
    if (!active || !slot) return null;
    return (
        <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
            <div className="text-muted-foreground">gasdag {amsterdamDay(slot.start)}</div>
            <div className="font-semibold">{formatEuro(slot.price)}/m³</div>
        </div>
    );
}

export function GasCard({ slots, now }: { slots: Slot[]; now: number })
{
    const currentIndex = slots.findIndex((s) => s.start <= now && now < s.end);
    const current = slots[currentIndex];
    const previous = currentIndex > 0 ? slots[currentIndex - 1] : undefined;
    const next = currentIndex >= 0 ? slots[currentIndex + 1] : undefined;
    const change = current && previous ? current.price - previous.price : 0;
    const history = slots.filter((s) => s.start <= now);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Flame className="size-4 text-muted-foreground" aria-hidden />Gas</CardTitle>
                <CardDescription>Prijs per gasdag (06:00–06:00)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {current ? (
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight">{formatEuro(current.price)}</span>
                        <span className="text-muted-foreground">/m³</span>
                        {previous && Math.abs(change) >= 0.0005 && (
                            <span className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground">
                                {change < 0 ? <TrendingDown className="size-4" aria-hidden /> : <TrendingUp className="size-4" aria-hidden />}
                                {change < 0 ? "−" : "+"}{formatEuro(Math.abs(change))} t.o.v. gisteren
                            </span>
                        )}
                    </div>
                ) : (
                    <p className="text-muted-foreground">Geen gasprijs bekend voor vandaag.</p>
                )}

                {history.length > 1 && (
                    <div className="h-20" role="img" aria-label="Gasprijs van de afgelopen 30 dagen">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                <YAxis hide domain={["dataMin - 0.02", "dataMax + 0.02"]} />
                                <Tooltip content={<SparkTooltip />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
                                <Line dataKey="price" stroke="var(--series)" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <Stat label="Morgen" value={next ? formatEuro(next.price) : "–"} hint={next ? undefined : "nog niet bekend"} />
                    <Stat label="Gemiddeld 30 dagen" value={history.length ? formatEuro(average(history.map((s) => s.price))) : "–"} />
                </div>
            </CardContent>
        </Card>
    );
}
