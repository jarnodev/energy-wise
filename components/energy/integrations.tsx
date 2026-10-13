"use client";

import { CalendarPlus, Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CopyButton } from "./copy-button";
import { useSettings } from "./settings";

// The site's own origin, known only in the browser
function useOrigin()
{
    const [origin, setOrigin] = useState("https://jouw-domein.nl");
    useEffect(() => setOrigin(window.location.origin), []);
    return origin;
}

function useSettingsQuery()
{
    const { settings } = useSettings();
    const params = new URLSearchParams();
    if (settings.price.mode !== "allin") params.set("mode", settings.price.mode);
    if (!settings.price.vat) params.set("vat", "false");
    params.set("markup", String(settings.price.markupElectricity));
    return params;
}

export function CalendarCard()
{
    const origin = useOrigin();
    const [hours, setHours] = useState("2");
    const params = useSettingsQuery();
    params.set("hours", hours);
    const url = `${origin}/api/calendar?${params}`;
    const webcal = url.replace(/^https?:/, "webcal:");

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarPlus className="size-4 text-muted-foreground" aria-hidden />Agenda</CardTitle>
                <CardDescription>Elke dag het goedkoopste blok als afspraak in je agenda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ToggleGroup type="single" variant="outline" size="sm" value={hours} onValueChange={(v) => v && setHours(v)} aria-label="Lengte van het blok">
                    {["1", "2", "3", "4"].map((h) => <ToggleGroupItem key={h} value={h} className="px-3">{h} uur</ToggleGroupItem>)}
                </ToggleGroup>
                <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm"><a href={webcal}>Abonneren</a></Button>
                    <Button asChild size="sm" variant="outline">
                        <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer">Google Agenda</a>
                    </Button>
                    <CopyButton text={url} label="Kopieer link" />
                </div>
                <p className="text-xs text-muted-foreground">De agenda ververst automatisch; morgen verschijnt zodra de prijzen bekend zijn.</p>
            </CardContent>
        </Card>
    );
}

export function ApiCard()
{
    const origin = useOrigin();
    const params = useSettingsQuery();
    const yaml = `rest:
  - resource: ${origin}/api/v1/now?${params}
    scan_interval: 300
    sensor:
      - name: Stroomprijs
        value_template: "{{ value_json.price }}"
        unit_of_measurement: "EUR/kWh"
        json_attributes: [level, today, cheapest]
      - name: Goedkoopste blok start
        value_template: "{{ value_json.cheapest.start }}"
        device_class: timestamp`;

    const endpoints = [
        { path: `/api/v1/now?${params}`, text: "Huidige prijs, niveau en het volgende goedkoopste blok" },
        { path: `/api/v1/prices?kind=electricity&interval=quarter&${params}`, text: "Kwartierprijzen van vandaag en morgen (of from/till)" },
        { path: "/api/v1/prices?kind=gas", text: "Gasprijzen per gasdag" },
        { path: "/api/summary", text: "Het dagbericht" },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Code2 className="size-4 text-muted-foreground" aria-hidden />Open API & Home Assistant</CardTitle>
                <CardDescription>Gratis JSON, zonder sleutel. Prijzen in euro, met dezelfde instellingen als hierboven.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
                <ul className="min-w-0 space-y-3">
                    {endpoints.map((e) => (
                        <li key={e.path} className="space-y-1">
                            <a href={e.path} target="_blank" rel="noreferrer" className="block break-all font-mono text-xs text-foreground underline-offset-4 hover:underline">GET {e.path}</a>
                            <p className="text-sm text-muted-foreground">{e.text}</p>
                        </li>
                    ))}
                    <li className="text-sm text-muted-foreground">
                        Parameters: <code className="font-mono text-xs">mode=allin|market</code>, <code className="font-mono text-xs">vat=false</code>, <code className="font-mono text-xs">markup</code>, <code className="font-mono text-xs">hours</code>, <code className="font-mono text-xs">from</code>/<code className="font-mono text-xs">till</code> (JJJJ-MM-DD).
                    </li>
                </ul>
                <div className="min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">configuration.yaml</span>
                        <CopyButton text={yaml} />
                    </div>
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">{yaml}</pre>
                </div>
            </CardContent>
        </Card>
    );
}
