"use client";

import { BatteryCharging, Car, Scale } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { amsterdamDay, amsterdamDayOffset, amsterdamStartOfDay, amsterdamTime } from "@/lib/dates";
import { formatRange } from "@/lib/insights";
import { compareContract, ContractComparison, planCharging, simulateBattery } from "@/lib/planner";
import { formatEuro, PriceSettings, Slot, toHourly } from "@/lib/pricing";
import { Stat } from "./section";
import { useSettings } from "./settings";

function parseNumber(value: string): number
{
    return Number(value.replace(",", "."));
}

// Labelled numeric input that accepts Dutch decimal commas
function NumberField({ label, value, onChange, suffix, step = "any" }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: string })
{
    const id = useId();
    const [text, setText] = useState(String(value).replace(".", ","));
    useEffect(() => setText(String(value).replace(".", ",")), [value]);

    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <Input
                    id={id}
                    inputMode="decimal"
                    step={step}
                    value={text}
                    onChange={(e) =>
                    {
                        setText(e.target.value);
                        const number = parseNumber(e.target.value);
                        if (Number.isFinite(number) && e.target.value.trim() !== "") onChange(number);
                    }}
                    className={suffix ? "pr-14" : undefined}
                />
                {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>}
            </div>
        </div>
    );
}

function Result({ children }: { children: React.ReactNode })
{
    return <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-3">{children}</div>;
}

function settingsQuery(settings: PriceSettings)
{
    return new URLSearchParams({
        mode: settings.mode,
        vat: String(settings.vat),
        markup: String(settings.markupElectricity),
        markup_gas: String(settings.markupGas),
    });
}

function ContractTool()
{
    const { settings } = useSettings();
    const [usage, setUsage] = useState(2700);
    const [fixedPrice, setFixedPrice] = useState(0.27);
    const [flexible, setFlexible] = useState(15);
    const [gasUsage, setGasUsage] = useState(1100);
    const [fixedGas, setFixedGas] = useState(1.35);
    const [data, setData] = useState<{ electricity: Slot[]; gas: Slot[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const load = async () =>
    {
        setLoading(true);
        setError(false);
        try {
            const from = amsterdamDayOffset(-365);
            const till = amsterdamDayOffset(-1);
            const query = settingsQuery(settings.price);
            const [electricity, gas] = await Promise.all(
                [`/api/v1/prices?kind=electricity&interval=hour&from=${from}&till=${till}&${query}`, `/api/v1/prices?kind=gas&from=${from}&till=${till}&${query}`]
                    .map((url) => fetch(url).then((r) => (r.ok ? (r.json() as Promise<{ prices: Array<{ start: string; end: string; price: number }> }>) : Promise.reject(new Error(String(r.status)))))),
            );
            const toSlots = (prices: Array<{ start: string; end: string; price: number }>) => prices.map((p) => ({ start: Date.parse(p.start), end: Date.parse(p.end), price: p.price }));
            setData({ electricity: toSlots(electricity.prices), gas: toSlots(gas.prices) });
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    // Recalculate with fresh prices when the price settings change after a first calculation
    useEffect(() =>
    {
        if (data) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.price]);

    const electricity: ContractComparison | null = data ? compareContract(data.electricity, "electricity", usage, fixedPrice, flexible / 100) : null;
    const gas: ContractComparison | null = data ? compareContract(data.gas, "gas", gasUsage, fixedGas) : null;
    const total = electricity && gas ? electricity.dynamicCost + gas.dynamicCost - electricity.fixedCost - gas.fixedCost : null;

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
                Wat had je het afgelopen jaar betaald met een dynamisch contract, vergeleken met je vaste tarief? Gebaseerd op echte prijzen en een gemiddeld verbruikspatroon per uur en maand.
                Vaste kosten (vastrecht, netbeheer) blijven buiten beschouwing; die zijn bij beide contracten gelijk.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField label="Stroomverbruik per jaar" value={usage} onChange={setUsage} suffix="kWh" />
                <NumberField label="Je vaste stroomtarief" value={fixedPrice} onChange={setFixedPrice} suffix="€/kWh" />
                <div className="space-y-3">
                    <Label>Verschuifbaar verbruik: {flexible}%</Label>
                    <Slider value={[flexible]} onValueChange={([v]) => setFlexible(v)} min={0} max={50} step={5} aria-label="Verschuifbaar verbruik" />
                    <p className="text-xs text-muted-foreground">Deel dat je naar de goedkoopste uren verplaatst (vaatwasser, auto, boiler)</p>
                </div>
                <NumberField label="Gasverbruik per jaar" value={gasUsage} onChange={setGasUsage} suffix="m³" />
                <NumberField label="Je vaste gastarief" value={fixedGas} onChange={setFixedGas} suffix="€/m³" />
                <div className="flex items-end">
                    <Button onClick={load} disabled={loading} className="w-full">{loading ? "Prijzen laden…" : data ? "Opnieuw berekenen" : "Bereken"}</Button>
                </div>
            </div>

            {error && <p className="text-sm text-destructive">De prijshistorie kon niet worden geladen. Probeer het later opnieuw.</p>}

            {electricity && gas && total !== null && (
                <div className="space-y-3">
                    <Result>
                        <Stat label="Stroom dynamisch" value={formatEuro(electricity.dynamicCost, 0)} hint={`gem. ${formatEuro(electricity.averagePrice)}/kWh`} />
                        <Stat label="Stroom vast" value={formatEuro(electricity.fixedCost, 0)} hint={`${formatEuro(fixedPrice)}/kWh`} />
                        <Stat label="Gas dynamisch" value={formatEuro(gas.dynamicCost, 0)} hint={`gem. ${formatEuro(gas.averagePrice)}/m³ (gewogen naar stookseizoen)`} />
                        <Stat label="Gas vast" value={formatEuro(gas.fixedCost, 0)} hint={`${formatEuro(fixedGas)}/m³`} />
                        <Stat
                            label={total < 0 ? "Dynamisch was goedkoper" : "Vast was goedkoper"}
                            value={formatEuro(Math.abs(total), 0)}
                            hint="per jaar, stroom en gas samen"
                        />
                    </Result>
                    <p className="text-xs text-muted-foreground">
                        Op basis van {electricity.days} dagen stroom- en {gas.days} dagen gasprijzen met jouw prijsinstellingen ({settings.price.mode === "allin" ? `opslag ${formatEuro(settings.price.markupElectricity)}/kWh` : "kale marktprijs"}). Indicatief: je werkelijke verbruikspatroon bepaalt de uitkomst.
                    </p>
                </div>
            )}
        </div>
    );
}

function nextOccurrence(time: string, now: number): number
{
    const [h, m] = time.split(":").map(Number);
    for (const offset of [0, 1, 2]) {
        const day = amsterdamDayOffset(offset, new Date(now));
        const candidate = amsterdamStartOfDay(day).getTime() + (h * 60 + m) * 60_000;
        if (candidate > now) return candidate;
    }
    return now;
}

function ChargingTool({ slots, now }: { slots: Slot[]; now: number })
{
    const [energy, setEnergy] = useState(30);
    const [power, setPower] = useState(11);
    const [ready, setReady] = useState("07:00");
    const deadline = nextOccurrence(ready, now);
    const plan = useMemo(() => planCharging(slots, energy, power, Math.floor(now / 900_000) * 900_000, deadline), [slots, energy, power, now, deadline]);

    // Merge adjacent slots into readable time ranges
    const ranges: Array<{ start: number; end: number; energy: number }> = [];
    for (const slot of plan?.slots ?? []) {
        const last = ranges[ranges.length - 1];
        if (last && last.end === slot.start) {
            last.end = slot.end;
            last.energy += slot.energy;
        } else {
            ranges.push({ start: slot.start, end: slot.end, energy: slot.energy });
        }
    }
    const lastKnown = slots.length ? slots[slots.length - 1].end : now;

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">Het goedkoopste laadschema voor je auto (of thuisbatterij, warmtepompboiler) binnen de bekende prijzen.</p>
            <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Te laden energie" value={energy} onChange={setEnergy} suffix="kWh" />
                <NumberField label="Laadvermogen" value={power} onChange={setPower} suffix="kW" />
                <div className="space-y-1.5">
                    <Label htmlFor="ready-at">Klaar om</Label>
                    <Input id="ready-at" type="time" value={ready} onChange={(e) => e.target.value && setReady(e.target.value)} />
                </div>
            </div>
            {plan && plan.slots.length > 0 ? (
                <div className="space-y-3">
                    <Result>
                        <Stat label="Kosten met dit schema" value={formatEuro(plan.cost, 2)} hint={`${plan.energy.toFixed(1).replace(".", ",")} kWh`} />
                        <Stat label="Direct laden" value={formatEuro(plan.costNow, 2)} />
                        <Stat label="Besparing" value={formatEuro(plan.costNow - plan.cost, 2)} hint={plan.costNow > 0 ? `${Math.round((1 - plan.cost / plan.costNow) * 100)}% goedkoper` : undefined} />
                    </Result>
                    <ul className="flex flex-wrap gap-2">
                        {ranges.map((r) => (
                            <li key={r.start} className="rounded-full border px-3 py-1 text-sm">
                                {amsterdamDay(r.start) === amsterdamDay(now) ? "vandaag" : "morgen"} {formatRange(r.start, r.end)} · {r.energy.toFixed(1).replace(".", ",")} kWh
                            </li>
                        ))}
                    </ul>
                    {plan.energy < energy - 0.01 && (
                        <p className="text-sm text-muted-foreground">Niet alles past vóór {ready}: er is te weinig tijd met bekende prijzen of laadvermogen.</p>
                    )}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {deadline > lastKnown ? `Prijzen zijn bekend tot ${amsterdamTime(lastKnown)}; vanaf ± 13:00 komen de prijzen van morgen erbij.` : "Geen laadmoment gevonden."}
                </p>
            )}
        </div>
    );
}

function BatteryTool({ slots, now }: { slots: Slot[]; now: number })
{
    const [capacity, setCapacity] = useState(10);
    const [power, setPower] = useState(5);
    const [efficiency, setEfficiency] = useState(90);
    const past = useMemo(() => toHourly(slots.filter((s) => s.end <= now)), [slots, now]);
    const result = useMemo(() => simulateBattery(past, capacity, power, efficiency / 100), [past, capacity, power, efficiency]);
    const perYear = result.days > 0 ? (result.savings / result.days) * 365 : 0;

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
                Wat had een thuisbatterij opgeleverd door goedkoop te laden en duur zelf te gebruiken? Berekend met het best mogelijke schema over de afgelopen {Math.round(result.days)} dagen.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Capaciteit" value={capacity} onChange={setCapacity} suffix="kWh" />
                <NumberField label="Laad-/ontlaadvermogen" value={power} onChange={setPower} suffix="kW" />
                <NumberField label="Rendement heen en terug" value={efficiency} onChange={(v) => setEfficiency(Math.min(100, Math.max(50, v)))} suffix="%" />
            </div>
            <Result>
                <Stat label={`Besparing ${Math.round(result.days)} dagen`} value={formatEuro(result.savings, 2)} />
                <Stat label="Omgerekend per jaar" value={formatEuro(perYear, 0)} hint="zonder zonnepanelen" />
                <Stat label="Laadcycli" value={result.cycles.toFixed(1).replace(".", ",")} hint={`${(result.cycles / Math.max(1, result.days)).toFixed(2).replace(".", ",")} per dag`} />
            </Result>
            <p className="text-xs text-muted-foreground">
                Bovengrens: het schema kent de prijzen vooraf en gaat ervan uit dat je huis de ontladen stroom direct verbruikt. Met zonnepanelen en na het einde van de saldering is de opbrengst meestal hoger.
            </p>
        </div>
    );
}

export function ToolsCard({ slots, now }: { slots: Slot[]; now: number })
{
    return (
        <Card>
            <CardContent>
                <Tabs defaultValue="contract">
                    <TabsList className="mb-4 h-auto flex-wrap">
                        <TabsTrigger value="contract"><Scale aria-hidden />Dynamisch of vast?</TabsTrigger>
                        <TabsTrigger value="charging"><Car aria-hidden />Auto laden</TabsTrigger>
                        <TabsTrigger value="battery"><BatteryCharging aria-hidden />Thuisbatterij</TabsTrigger>
                    </TabsList>
                    <TabsContent value="contract"><ContractTool /></TabsContent>
                    <TabsContent value="charging"><ChargingTool slots={slots} now={now} /></TabsContent>
                    <TabsContent value="battery"><BatteryTool slots={slots} now={now} /></TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
