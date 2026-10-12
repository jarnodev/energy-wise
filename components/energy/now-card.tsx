"use client";

import { Clock, Flame, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { amsterdamDay, amsterdamDayOffset, amsterdamTime } from "@/lib/dates";
import { formatRange } from "@/lib/insights";
import { Block, cheapestBlock } from "@/lib/planner";
import { average, formatEuro, priceLevel, Slot } from "@/lib/pricing";
import { LevelBadge, LEVELS } from "./level";
import { useSettings } from "./settings";

const DURATIONS = [60, 120, 180, 240];

function startsIn(block: Block, now: number): string
{
    if (block.start <= now) return "nu bezig";
    const minutes = Math.round((block.start - now) / 60_000);
    if (minutes < 60) return `over ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `over ${hours} u${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

function dayLabel(start: number, now: number): string
{
    const day = amsterdamDay(start);
    if (day === amsterdamDay(now)) return "Vandaag";
    if (day === amsterdamDayOffset(1, new Date(now))) return "Morgen";
    return day;
}

export function NowCard({ slots, gasSlots, now }: { slots: Slot[]; gasSlots: Slot[]; now: number })
{
    const { settings, update } = useSettings();
    const today = amsterdamDay(now);
    const tomorrow = amsterdamDayOffset(1, new Date(now));

    const current = slots.find((s) => s.start <= now && now < s.end);
    const todayPrices = slots.filter((s) => amsterdamDay(s.start) === today).map((s) => s.price);
    const level = current ? priceLevel(current.price, todayPrices) : null;
    const gas = gasSlots.find((s) => s.start <= now && now < s.end);

    const quarterStart = Math.floor(now / 900_000) * 900_000;
    const upcoming = cheapestBlock(slots, settings.blockMinutes, quarterStart);
    const tomorrowSlots = slots.filter((s) => amsterdamDay(s.start) === tomorrow);
    const tomorrowBlock = tomorrowSlots.length ? cheapestBlock(tomorrowSlots, settings.blockMinutes) : null;
    const unit = settings.price.mode === "allin" ? "all-in" : "marktprijs";

    return (
        <Card
            className="overflow-hidden"
            style={level ? { backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${LEVELS[level].color} 16%, transparent), transparent 55%)` } : undefined}
        >
            <CardContent className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="size-4" aria-hidden />
                        {current ? `Stroom nu · ${formatRange(current.start, current.end)}` : "Stroom nu"}
                    </div>
                    {current ? (
                        <>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold tracking-tight sm:text-6xl">{formatEuro(current.price)}</span>
                                <span className="text-muted-foreground">/kWh</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                {level && <LevelBadge level={level} className="bg-background/60 text-foreground" />}
                                <span>daggemiddelde {formatEuro(average(todayPrices))} · {unit}{settings.price.vat ? " incl. btw" : " excl. btw"}</span>
                            </div>
                        </>
                    ) : (
                        <p className="text-muted-foreground">Er is nog geen prijs bekend voor dit moment.</p>
                    )}
                    {gas && (
                        <div className="flex items-center gap-2 pt-2 text-sm">
                            <Flame className="size-4 text-muted-foreground" aria-hidden />
                            Gas vandaag <span className="font-semibold">{formatEuro(gas.price)}/m³</span>
                        </div>
                    )}
                </div>

                <div className="space-y-4 rounded-xl border bg-background/70 p-4 backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">Goedkoopste moment</h3>
                        <ToggleGroup
                            type="single"
                            size="sm"
                            variant="outline"
                            value={String(settings.blockMinutes)}
                            onValueChange={(value) => value && update({ blockMinutes: Number(value) })}
                            aria-label="Duur van het blok"
                        >
                            {DURATIONS.map((minutes) => (
                                <ToggleGroupItem key={minutes} value={String(minutes)} className="px-2.5">
                                    {minutes / 60} u
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </div>

                    {upcoming ? (
                        <div>
                            <div className="text-2xl font-semibold">
                                {dayLabel(upcoming.start, now)} {formatRange(upcoming.start, upcoming.end)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                <span>gemiddeld {formatEuro(upcoming.average)}/kWh</span>
                                <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{startsIn(upcoming, now)}</span>
                                {current && upcoming.average < current.price && (
                                    <span>{Math.round((1 - upcoming.average / current.price) * 100)}% goedkoper dan nu</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Te weinig bekende prijzen voor een blok van deze lengte.</p>
                    )}

                    <div className="border-t pt-3 text-sm">
                        {tomorrowBlock ? (
                            <p>
                                <span className="text-muted-foreground">Morgen het goedkoopst: </span>
                                <span className="font-medium">{formatRange(tomorrowBlock.start, tomorrowBlock.end)}</span>
                                <span className="text-muted-foreground"> · {formatEuro(tomorrowBlock.average)}/kWh</span>
                            </p>
                        ) : (
                            <p className="text-muted-foreground">De prijzen voor morgen verschijnen rond 13:00 · laatst bekend tot {slots.length ? amsterdamTime(slots[slots.length - 1].end) : "–"}.</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
