"use client";

import { MapPin, Settings2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_SETTINGS, useSettings } from "./settings";

const ORIENTATIONS = [
    { value: "0", label: "Zuid" },
    { value: "-45", label: "Zuidoost" },
    { value: "45", label: "Zuidwest" },
    { value: "-90", label: "Oost" },
    { value: "90", label: "West" },
];

function DecimalInput({ label, value, onChange, suffix, hint }: { label: string; value: number; onChange: (value: number) => void; suffix: string; hint?: string })
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
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={() =>
                    {
                        const number = Number(text.replace(",", "."));
                        if (Number.isFinite(number) && text.trim() !== "") onChange(number);
                        else setText(String(value).replace(".", ","));
                    }}
                    className="pr-16"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
            </div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

function LocationSearch()
{
    const { settings, update } = useSettings();
    const [query, setQuery] = useState("");
    const [state, setState] = useState<"idle" | "busy" | "error">("idle");

    const search = async (e: React.FormEvent) =>
    {
        e.preventDefault();
        if (query.trim().length < 2) return;
        setState("busy");
        try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
            if (!response.ok) throw new Error();
            const result = (await response.json()) as { name: string; latitude: number; longitude: number };
            update({ location: { name: result.name, latitude: result.latitude, longitude: result.longitude } });
            setQuery("");
            setState("idle");
        } catch {
            setState("error");
        }
    };

    return (
        <form onSubmit={search} className="space-y-1.5">
            <Label htmlFor="location">Locatie (voor de zonverwachting)</Label>
            <div className="flex gap-2">
                <Input id="location" placeholder="Postcode of plaats" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Button type="submit" variant="outline" disabled={state === "busy"}>Zoek</Button>
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" aria-hidden />
                {state === "error" ? "Niet gevonden, probeer een postcode zoals 3511AB" : settings.location.name}
            </p>
        </form>
    );
}

export function SettingsSheet()
{
    const { settings, update } = useSettings();
    const price = settings.price;
    const setPrice = (patch: Partial<typeof price>) => update({ price: { ...price, ...patch } });
    const setSolar = (patch: Partial<typeof settings.solar>) => update({ solar: { ...settings.solar, ...patch } });

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm"><Settings2 />Instellingen</Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Instellingen</SheetTitle>
                    <SheetDescription>Opgeslagen in deze browser. Alle prijzen, tools en meldingen rekenen hiermee.</SheetDescription>
                </SheetHeader>
                <div className="space-y-6 px-4 pb-8">
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Prijs</h3>
                        <ToggleGroup type="single" variant="outline" value={price.mode} onValueChange={(v) => v && setPrice({ mode: v as "allin" | "market" })} className="w-full">
                            <ToggleGroupItem value="allin" className="flex-1">All-in (wat je betaalt)</ToggleGroupItem>
                            <ToggleGroupItem value="market" className="flex-1">Kale marktprijs</ToggleGroupItem>
                        </ToggleGroup>
                        <p className="text-xs text-muted-foreground">
                            {price.mode === "allin" ? "Marktprijs + energiebelasting + opslag van je leverancier." : "De inkoopprijs op de beurs, zonder belasting en opslag."}
                        </p>
                        <label className="flex items-center justify-between text-sm">
                            Inclusief 21% btw
                            <Switch checked={price.vat} onCheckedChange={(vat) => setPrice({ vat })} />
                        </label>
                        {price.mode === "allin" && (
                            <div className="grid grid-cols-2 gap-3">
                                <DecimalInput label="Opslag stroom" value={price.markupElectricity} onChange={(markupElectricity) => setPrice({ markupElectricity })} suffix="€/kWh" />
                                <DecimalInput label="Opslag gas" value={price.markupGas} onChange={(markupGas) => setPrice({ markupGas })} suffix="€/m³" />
                                <p className="col-span-2 text-xs text-muted-foreground">Excl. btw, zie je contract of tarievenblad. Standaard {String(DEFAULT_SETTINGS.price.markupElectricity).replace(".", ",")} en {String(DEFAULT_SETTINGS.price.markupGas).replace(".", ",")}.</p>
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Zonnepanelen</h3>
                        <LocationSearch />
                        <DecimalInput label="Vermogen" value={settings.solar.peakPower} onChange={(peakPower) => setSolar({ peakPower: Math.max(0, peakPower) })} suffix="kWp" hint="0 = geen panelen. Aantal panelen × wattpiek ÷ 1000." />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Richting</Label>
                                <Select value={String(settings.solar.azimuth)} onValueChange={(v) => setSolar({ azimuth: Number(v) })}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ORIENTATIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Hellingshoek</Label>
                                <Select value={String(settings.solar.tilt)} onValueChange={(v) => setSolar({ tilt: Number(v) })}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {[10, 15, 20, 25, 30, 35, 40, 45].map((t) => <SelectItem key={t} value={String(t)}>{t}°</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <Button variant="ghost" size="sm" onClick={() => update(DEFAULT_SETTINGS)}>Standaardinstellingen herstellen</Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
