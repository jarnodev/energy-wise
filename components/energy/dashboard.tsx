"use client";

import { Zap } from "lucide-react";
import { useMemo } from "react";
import { ThemeToggler } from "@/components/theme-toggler";
import type { PricePoint } from "@/lib/energyzero";
import { toSlots } from "@/lib/pricing";
import type { Summary } from "@/lib/prices";
import { AlertsCard } from "./alerts-card";
import { GasCard } from "./gas-card";
import { HistoryCard } from "./history-card";
import { ApiCard, CalendarCard } from "./integrations";
import { NowCard } from "./now-card";
import { PriceChartCard } from "./price-chart-card";
import { Section } from "./section";
import { SettingsProvider, useNow, useSettings } from "./settings";
import { SettingsSheet } from "./settings-sheet";
import { SolarCard } from "./solar-card";
import { SummaryCard } from "./summary-card";
import { ToolsCard } from "./tools-card";

export type DashboardData = {
    electricity: PricePoint[];
    gas: PricePoint[];
    summary: Summary | null;
    renderedAt: number;
};

const NAV = [
    { href: "#prijzen", label: "Prijzen" },
    { href: "#zon", label: "Zon" },
    { href: "#rekenhulp", label: "Rekenhulp" },
    { href: "#koppelingen", label: "Meldingen & API" },
];

function Header()
{
    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
                <a href="#" className="flex items-center gap-2 font-semibold">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background"><Zap className="size-4" aria-hidden /></span>
                    Energy Wise
                </a>
                <nav aria-label="Secties" className="hidden flex-1 md:block">
                    <ul className="flex gap-1 text-sm text-muted-foreground">
                        {NAV.map((item) => (
                            <li key={item.href}><a href={item.href} className="rounded-md px-2.5 py-1.5 hover:bg-accent hover:text-foreground">{item.label}</a></li>
                        ))}
                    </ul>
                </nav>
                <div className="ml-auto flex items-center gap-1">
                    <SettingsSheet />
                    <ThemeToggler />
                </div>
            </div>
        </header>
    );
}

function Footer()
{
    return (
        <footer className="border-t">
            <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-muted-foreground">
                <p>
                    Prijzen: <a className="underline-offset-4 hover:underline" href="https://www.energyzero.nl" target="_blank" rel="noreferrer">EnergyZero</a> (day-ahead markt).
                    Zonverwachting: <a className="underline-offset-4 hover:underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>.
                    Locaties: <a className="underline-offset-4 hover:underline" href="https://www.pdok.nl" target="_blank" rel="noreferrer">PDOK</a>.
                </p>
                <p>Alle bedragen zijn indicatief; je leverancier en netbeheerder bepalen je werkelijke rekening.</p>
                <p>© {new Date().getFullYear()} Energy Wise · gemaakt door <a href="https://github.com/jarnodev" className="underline-offset-4 hover:underline">JarnoDev</a></p>
            </div>
        </footer>
    );
}

function Content({ electricity, gas, summary, renderedAt }: DashboardData)
{
    const { settings } = useSettings();
    const now = useNow(renderedAt);
    const slots = useMemo(() => toSlots(electricity, "electricity", settings.price), [electricity, settings.price]);
    const gasSlots = useMemo(() => toSlots(gas, "gas", settings.price), [gas, settings.price]);

    return (
        <main className="mx-auto max-w-6xl space-y-12 px-4 py-8">
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2"><NowCard slots={slots} gasSlots={gasSlots} now={now} /></div>
                <SummaryCard summary={summary} slots={slots} now={now} />
            </div>

            <Section id="prijzen" title="Prijzen" description="Day-ahead prijzen van de stroombeurs, omgerekend naar jouw instellingen">
                <PriceChartCard slots={slots} now={now} />
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2"><HistoryCard slots={slots} now={now} /></div>
                    <GasCard slots={gasSlots} now={now} />
                </div>
            </Section>

            <Section id="zon" title="Zon & teruglevering" description="Wanneer je panelen het meest leveren, en wat dat waard is">
                <SolarCard points={electricity} now={now} />
            </Section>

            <Section id="rekenhulp" title="Rekenhulp" description="Laadschema's, batterijen en contracten doorrekenen met echte prijzen en jouw prijsinstellingen">
                <ToolsCard slots={slots} now={now} />
            </Section>

            <Section id="koppelingen" title="Meldingen & koppelingen" description="Laat de goedkope uren naar jou toe komen">
                <div className="grid gap-6 md:grid-cols-2">
                    <AlertsCard />
                    <CalendarCard />
                </div>
                <ApiCard />
            </Section>
        </main>
    );
}

export function Dashboard(props: DashboardData)
{
    return (
        <SettingsProvider>
            <Header />
            <Content {...props} />
            <Footer />
        </SettingsProvider>
    );
}
