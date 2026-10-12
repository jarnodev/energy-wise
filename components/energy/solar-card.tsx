"use client";

import { AlertTriangle, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { amsterdamDay, amsterdamDayOffset, amsterdamTime } from "@/lib/dates";
import type { PricePoint } from "@/lib/energyzero";
import { formatRange } from "@/lib/insights";
import { effectivePrice, formatEuro } from "@/lib/pricing";
import { SolarPoint, solarYield } from "@/lib/solar";
import { Stat } from "./section";
import { useSettings } from "./settings";

// Net metering ends on 1 January 2027; after that, feeding in only earns a (much lower) feed-in tariff
const NET_METERING_END = Date.parse("2026-12-31T23:00:00Z");

type HourDatum = { start: number; end: number; kwh: number; irradiance: number; price?: number; market?: number };

function SolarTooltip({ active, payload, perKwp }: { active?: boolean; payload?: Array<{ payload: HourDatum }>; perKwp: boolean })
{
    const d = payload?.[0]?.payload;
    if (!active || !d) return null;
    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
            <div className="text-muted-foreground">{formatRange(d.start, d.end)}</div>
            <div className="font-semibold">{perKwp ? `${Math.round(d.irradiance)} W/m²` : `${d.kwh.toFixed(2).replace(".", ",")} kWh`}</div>
            {d.price !== undefined && <div className="text-xs text-muted-foreground">stroomprijs {formatEuro(d.price)}/kWh</div>}
        </div>
    );
}

export function SolarCard({ points, now }: { points: PricePoint[]; now: number })
{
    const { settings, update } = useSettings();
    const [forecast, setForecast] = useState<SolarPoint[] | null>(null);
    const [error, setError] = useState(false);
    const [day, setDay] = useState<"today" | "tomorrow">("today");
    const { latitude, longitude, name } = settings.location;
    const { peakPower, tilt, azimuth } = settings.solar;

    useEffect(() =>
    {
        const controller = new AbortController();
        setError(false);
        const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), tilt: String(tilt), azimuth: String(azimuth) });
        fetch(`/api/solar?${params}`, { signal: controller.signal })
            .then((r) => (r.ok ? (r.json() as Promise<{ hours: SolarPoint[] }>) : Promise.reject(new Error(String(r.status)))))
            .then((data) => setForecast(data.hours))
            .catch((e) => e.name !== "AbortError" && setError(true));
        return () => controller.abort();
    }, [latitude, longitude, tilt, azimuth]);

    const selectedDay = day === "today" ? amsterdamDay(now) : amsterdamDayOffset(1, new Date(now));
    const hasPanels = peakPower > 0;

    // Average the price points per hour so they line up with the hourly forecast
    const priceByHour = new Map<number, { price: number[]; market: number[] }>();
    for (const p of points) {
        const hour = Math.floor(Date.parse(p.start) / 3_600_000) * 3_600_000;
        const entry = priceByHour.get(hour) ?? { price: [], market: [] };
        entry.price.push(effectivePrice(p, "electricity", settings.price));
        entry.market.push(p.base);
        priceByHour.set(hour, entry);
    }
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

    const data: HourDatum[] = (forecast ?? [])
        .filter((h) => amsterdamDay(h.start) === selectedDay)
        .map((h) =>
        {
            const start = Date.parse(h.start);
            const prices = priceByHour.get(start);
            return {
                start,
                end: Date.parse(h.end),
                irradiance: h.irradiance,
                kwh: solarYield(h.irradiance, peakPower || 1),
                price: prices ? mean(prices.price) : undefined,
                market: prices ? mean(prices.market) : undefined,
            };
        });

    const total = data.reduce((sum, d) => sum + d.kwh, 0);
    const peak = data.reduce((max, d) => Math.max(max, d.kwh), 0);
    // Best hours for own use: the contiguous run around the peak producing at least half of the peak
    const strong = data.filter((d) => peak > 0 && d.kwh >= peak / 2);
    const window = strong.length ? { start: strong[0].start, end: strong[strong.length - 1].end } : null;
    const negativeOverlap = data.filter((d) => d.kwh > 0.05 * (peakPower || 1) && (d.market ?? 0) < 0);
    // Value of using a kWh yourself (saves the all-in price) versus feeding it in (earns at most the market price)
    const priced = data.filter((d) => d.kwh > 0 && d.price !== undefined && d.market !== undefined);
    const extraValue = priced.reduce((sum, d) => sum + d.kwh * (d.price! - d.market!), 0);
    const daysUntilEnd = Math.ceil((NET_METERING_END - now) / 86_400_000);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2"><Sun className="size-4 text-muted-foreground" aria-hidden />Zonnestroom in {name.split(",").pop()?.trim()}</CardTitle>
                    <CardDescription>
                        {hasPanels ? `Verwachte opbrengst van ${String(peakPower).replace(".", ",")} kWp, ${tilt}° helling` : "Zonkracht op schuine panelen. Vul je vermogen in voor de opbrengst in kWh."}
                    </CardDescription>
                </div>
                <Tabs value={day} onValueChange={(v) => setDay(v as "today" | "tomorrow")}>
                    <TabsList>
                        <TabsTrigger value="today">Vandaag</TabsTrigger>
                        <TabsTrigger value="tomorrow">Morgen</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="space-y-4">
                {daysUntilEnd > 0 && (
                    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                        <span className="font-medium">De salderingsregeling stopt over {daysUntilEnd} dagen.</span>{" "}
                        <span className="text-muted-foreground">Vanaf 1 januari 2027 levert zelf gebruiken meer op dan terugleveren: plan wassen, laden en koken in je zonuren.</span>
                    </div>
                )}

                {!hasPanels && (
                    <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={(e) =>
                        {
                            e.preventDefault();
                            const value = Number(new FormData(e.currentTarget).get("kwp")?.toString().replace(",", "."));
                            if (value > 0 && value < 100) update({ solar: { ...settings.solar, peakPower: value } });
                        }}
                    >
                        <div className="space-y-1">
                            <Label htmlFor="kwp-inline">Vermogen zonnepanelen (kWp)</Label>
                            <Input id="kwp-inline" name="kwp" inputMode="decimal" placeholder="bijv. 4,2" className="w-36" />
                        </div>
                        <button type="submit" className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-accent">Opslaan</button>
                        <span className="text-xs text-muted-foreground">Tip: aantal panelen × wattpiek ÷ 1000</span>
                    </form>
                )}

                {error ? (
                    <p className="text-sm text-muted-foreground">De zonverwachting kon niet worden geladen.</p>
                ) : !forecast ? (
                    <Skeleton className="h-48 w-full" />
                ) : (
                    <div className="h-48 w-full" role="img" aria-label={`Verwachte zonnestroom per uur op ${selectedDay}`}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
                                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                                <XAxis dataKey="start" tickFormatter={(v: number) => amsterdamTime(v)} interval={2} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                                <YAxis width={52} dataKey={hasPanels ? "kwh" : "irradiance"} tickFormatter={(v: number) => (hasPanels ? `${v.toFixed(1).replace(".", ",")}` : `${Math.round(v)}`)} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} label={{ value: hasPanels ? "kWh" : "W/m²", angle: -90, position: "insideLeft", fill: "var(--chart-axis)", fontSize: 12 }} />
                                <Tooltip content={<SolarTooltip perKwp={!hasPanels} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                                <Bar dataKey={hasPanels ? "kwh" : "irradiance"} fill="var(--solar)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {forecast && negativeOverlap.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                            Negatieve marktprijs tijdens {negativeOverlap.length} zonuren ({formatRange(negativeOverlap[0].start, negativeOverlap[negativeOverlap.length - 1].end)}).
                            Terugleveren kan je dan geld kosten bij een dynamisch contract; gebruik de stroom zelf of begrens je omvormer.
                        </span>
                    </div>
                )}

                {forecast && hasPanels && (
                    <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
                        <Stat label="Verwachte opbrengst" value={`${total.toFixed(1).replace(".", ",")} kWh`} />
                        <Stat label="Beste uren voor eigen gebruik" value={window ? formatRange(window.start, window.end) : "–"} />
                        <Stat label="Zelf gebruiken i.p.v. terugleveren" value={priced.length ? `+${formatEuro(extraValue, 2)}` : "–"} hint={priced.length ? "meerwaarde zonder saldering" : "prijzen nog niet bekend"} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
