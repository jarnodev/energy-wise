"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { amsterdamDay, amsterdamDayOffset, amsterdamTime } from "@/lib/dates";
import { formatRange } from "@/lib/insights";
import { cheapestBlock } from "@/lib/planner";
import { average, formatEuro, PriceLevel, priceLevel, Slot, toHourly } from "@/lib/pricing";
import { LevelBadge, LevelLegend, LEVELS } from "./level";
import { Stat } from "./section";
import { useSettings } from "./settings";

type Datum = Slot & { level: PriceLevel };

// Bar with a 4px rounded end away from the zero line, so negative prices round at the bottom
function RoundedBar(props: { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: Datum })
{
    const { x = 0, y = 0, width = 0, height = 0, fill, payload } = props;
    const top = Math.min(y, y + height);
    const h = Math.abs(height);
    const r = Math.min(4, width / 2, h);
    if (h === 0) return null;
    const path = (payload?.price ?? 0) >= 0
        ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + h} Z`
        : `M${x},${top} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + width - r} Q${x + width},${top + h} ${x + width},${top + h - r} V${top} Z`;
    return <path d={path} fill={fill} />;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Datum }> })
{
    const datum = payload?.[0]?.payload;
    if (!active || !datum) return null;
    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
            <div className="text-muted-foreground">{formatRange(datum.start, datum.end)}</div>
            <div className="font-semibold">{formatEuro(datum.price)}/kWh</div>
            <LevelBadge level={datum.level} className="mt-1" />
        </div>
    );
}

export function PriceChartCard({ slots, now }: { slots: Slot[]; now: number })
{
    const { settings, update } = useSettings();
    const [day, setDay] = useState<"today" | "tomorrow">("today");
    const [showTable, setShowTable] = useState(false);

    const today = amsterdamDay(now);
    const tomorrow = amsterdamDayOffset(1, new Date(now));
    const hasTomorrow = slots.some((s) => amsterdamDay(s.start) === tomorrow);
    const selectedDay = day === "tomorrow" && hasTomorrow ? tomorrow : today;

    let daySlots = slots.filter((s) => amsterdamDay(s.start) === selectedDay);
    if (settings.granularity === "hour") daySlots = toHourly(daySlots);
    const prices = daySlots.map((s) => s.price);
    const data: Datum[] = daySlots.map((s) => ({ ...s, level: priceLevel(s.price, prices) }));

    const block = cheapestBlock(daySlots, settings.blockMinutes);
    const blockSlots = block ? daySlots.filter((s) => s.start >= block.start && s.end <= block.end) : [];
    const current = selectedDay === today ? daySlots.find((s) => s.start <= now && now < s.end) : undefined;
    const ticks = daySlots.filter((s) => new Date(s.start).getUTCMinutes() === 0 && Number(amsterdamTime(s.start).slice(0, 2)) % 3 === 0).map((s) => s.start);
    const min = data.length ? data.reduce((a, b) => (b.price < a.price ? b : a)) : null;
    const max = data.length ? data.reduce((a, b) => (b.price > a.price ? b : a)) : null;
    const negativeMinutes = daySlots.filter((s) => s.price < 0).reduce((sum, s) => sum + (s.end - s.start) / 60_000, 0);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <CardTitle>Stroomprijs per {settings.granularity === "quarter" ? "kwartier" : "uur"}</CardTitle>
                    <CardDescription>
                        {block ? <>Goedkoopste {settings.blockMinutes / 60} uur: <span className="font-medium text-foreground">{formatRange(block.start, block.end)}</span> ({formatEuro(block.average)})</> : "Geen prijzen bekend"}
                    </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={selectedDay === tomorrow ? "tomorrow" : "today"} onValueChange={(v) => setDay(v as "today" | "tomorrow")}>
                        <TabsList>
                            <TabsTrigger value="today">Vandaag</TabsTrigger>
                            <TabsTrigger value="tomorrow" disabled={!hasTomorrow} title={hasTomorrow ? undefined : "Beschikbaar vanaf ± 13:00"}>Morgen</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <ToggleGroup type="single" size="sm" variant="outline" value={settings.granularity} onValueChange={(v) => v && update({ granularity: v as "quarter" | "hour" })} aria-label="Resolutie">
                        <ToggleGroupItem value="quarter" className="px-2.5">Kwartier</ToggleGroupItem>
                        <ToggleGroupItem value="hour" className="px-2.5">Uur</ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="h-64 w-full sm:h-72" role="img" aria-label={`Staafdiagram van de stroomprijs op ${selectedDay}`}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 4 }} barCategoryGap={settings.granularity === "quarter" ? 1 : 2}>
                            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                            <XAxis dataKey="start" ticks={ticks} tickFormatter={(v: number) => amsterdamTime(v)} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                            <YAxis width={52} tickFormatter={(v: number) => formatEuro(v, 2)} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                            {blockSlots.length > 0 && (
                                <ReferenceArea x1={blockSlots[0].start} x2={blockSlots[blockSlots.length - 1].start} fill="var(--level-cheap)" fillOpacity={0.12} stroke="var(--level-cheap)" strokeOpacity={0.5} strokeDasharray="4 3" ifOverflow="extendDomain" />
                            )}
                            <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.6} />
                            {current && <ReferenceLine x={current.start} stroke="var(--foreground)" strokeDasharray="3 3" label={{ value: "nu", position: "top", fill: "var(--foreground)", fontSize: 12 }} />}
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                            <Bar dataKey="price" shape={<RoundedBar />} isAnimationActive={false}>
                                {data.map((d) => <Cell key={d.start} fill={LEVELS[d.level].color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <LevelLegend levels={negativeMinutes > 0 ? ["negative", "cheap", "normal", "expensive"] : ["cheap", "normal", "expensive"]} />
                    <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>
                        {showTable ? "Verberg tabel" : "Toon als tabel"}
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                    <Stat label="Gemiddeld" value={formatEuro(average(prices))} />
                    <Stat label="Laagst" value={min ? formatEuro(min.price) : "–"} hint={min && formatRange(min.start, min.end)} />
                    <Stat label="Hoogst" value={max ? formatEuro(max.price) : "–"} hint={max && formatRange(max.start, max.end)} />
                    <Stat label="Negatieve prijs" value={negativeMinutes ? `${negativeMinutes / 60} uur` : "Geen"} hint={max && min ? `spreiding ${formatEuro(max.price - min.price)}` : undefined} />
                </div>

                {showTable && (
                    <div className="max-h-80 overflow-auto rounded-lg border">
                        <table className="w-full text-sm tabular-nums">
                            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                                <tr><th className="px-3 py-2 font-medium">Tijd</th><th className="px-3 py-2 font-medium">Prijs per kWh</th><th className="px-3 py-2 font-medium">Niveau</th></tr>
                            </thead>
                            <tbody>
                                {data.map((d) => (
                                    <tr key={d.start} className="border-t">
                                        <td className="px-3 py-1.5">{formatRange(d.start, d.end)}</td>
                                        <td className="px-3 py-1.5">{formatEuro(d.price)}</td>
                                        <td className="px-3 py-1.5">{LEVELS[d.level].label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
