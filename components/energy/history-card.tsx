"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { amsterdamDay } from "@/lib/dates";
import { average, formatEuro, Slot } from "@/lib/pricing";
import { Stat } from "./section";

type DayDatum = { day: string; average: number; range: [number, number] };

const WEEKDAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const dayFormatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" });

function formatDay(day: string)
{
    return dayFormatter.format(new Date(`${day}T12:00:00Z`));
}

function HistoryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DayDatum }> })
{
    const d = payload?.[0]?.payload;
    if (!active || !d) return null;
    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
            <div className="text-muted-foreground">{WEEKDAYS[new Date(`${d.day}T12:00:00Z`).getUTCDay()]} {formatDay(d.day)}</div>
            <div className="font-semibold">gem. {formatEuro(d.average)}</div>
            <div className="text-xs text-muted-foreground">{formatEuro(d.range[0])} – {formatEuro(d.range[1])}</div>
        </div>
    );
}

export function HistoryCard({ slots, now }: { slots: Slot[]; now: number })
{
    const today = amsterdamDay(now);
    const perDay = new Map<string, number[]>();
    for (const slot of slots) {
        const day = amsterdamDay(slot.start);
        if (day > today) continue;
        perDay.set(day, [...(perDay.get(day) ?? []), slot.price]);
    }
    const data: DayDatum[] = [...perDay].map(([day, prices]) => ({ day, average: average(prices), range: [Math.min(...prices), Math.max(...prices)] }));

    const weekday = WEEKDAYS.map((label, i) => ({ label, average: average(data.filter((d) => new Date(`${d.day}T12:00:00Z`).getUTCDay() === i).map((d) => d.average)) }));
    const cheapestDay = data.length ? data.reduce((a, b) => (b.average < a.average ? b : a)) : null;
    const cheapestWeekday = weekday.filter((w) => w.average).reduce((a, b) => (b.average < a.average ? b : a), weekday[0]);
    const priciestWeekday = weekday.filter((w) => w.average).reduce((a, b) => (b.average > a.average ? b : a), weekday[0]);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Afgelopen 30 dagen</CardTitle>
                <CardDescription>Daggemiddelde stroomprijs, met de laagste en hoogste prijs van elke dag als band</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="h-56 w-full" role="img" aria-label="Daggemiddelde stroomprijs van de afgelopen 30 dagen">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                            <XAxis dataKey="day" tickFormatter={formatDay} minTickGap={24} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                            <YAxis width={52} tickFormatter={(v: number) => formatEuro(v, 2)} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                            <Tooltip content={<HistoryTooltip />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
                            <Area dataKey="range" stroke="none" fill="var(--series)" fillOpacity={0.15} isAnimationActive={false} />
                            <Line dataKey="average" stroke="var(--series)" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
                    <Stat label="Gemiddeld" value={formatEuro(average(data.map((d) => d.average)))} />
                    <Stat label="Goedkoopste dag" value={cheapestDay ? formatDay(cheapestDay.day) : "–"} hint={cheapestDay && formatEuro(cheapestDay.average)} />
                    <Stat label="Per weekdag" value={`${cheapestWeekday.label} goedkoopst`} hint={`${priciestWeekday.label} duurst`} />
                </div>
            </CardContent>
        </Card>
    );
}
