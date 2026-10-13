"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "./settings";

type Status = "loading" | "unsupported" | "ios-install" | "unconfigured" | "denied" | "off" | "on";

type Preferences = { digest: boolean; negative: boolean; thresholdEnabled: boolean; threshold: number };

const PREFS_KEY = "energy-wise:push";
const DEFAULT_PREFS: Preferences = { digest: true, negative: true, thresholdEnabled: false, threshold: 0.2 };

function toUint8Array(base64Url: string): Uint8Array<ArrayBuffer>
{
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function loadPrefs(): Preferences
{
    try {
        return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
    } catch {
        return DEFAULT_PREFS;
    }
}

export function AlertsCard()
{
    const { settings } = useSettings();
    const [status, setStatus] = useState<Status>("loading");
    const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [thresholdText, setThresholdText] = useState("0,20");

    useEffect(() =>
    {
        const loaded = loadPrefs();
        setPrefs(loaded);
        setThresholdText(String(loaded.threshold).replace(".", ","));

        (async () =>
        {
            const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
            const standalone = window.matchMedia("(display-mode: standalone)").matches;
            if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
                setStatus(isIos && !standalone ? "ios-install" : "unsupported");
                return;
            }
            const keyResponse = await fetch("/api/push").catch(() => null);
            if (!keyResponse?.ok) {
                setStatus("unconfigured");
                return;
            }
            if (Notification.permission === "denied") {
                setStatus("denied");
                return;
            }
            const registration = await navigator.serviceWorker.register("/sw.js");
            const subscription = await registration.pushManager.getSubscription();
            setStatus(subscription ? "on" : "off");
        })().catch(() => setStatus("unsupported"));
    }, []);

    const save = async (subscription: PushSubscription, next: Preferences) =>
    {
        const response = await fetch("/api/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                preferences: {
                    digest: next.digest,
                    negative: next.negative,
                    threshold: next.thresholdEnabled ? next.threshold : null,
                    settings: settings.price,
                },
            }),
        });
        if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Opslaan mislukt");
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    };

    const enable = async () =>
    {
        setBusy(true);
        setMessage(null);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                setStatus(permission === "denied" ? "denied" : "off");
                return;
            }
            const { publicKey } = (await (await fetch("/api/push")).json()) as { publicKey: string };
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(publicKey) });
            await save(subscription, prefs);
            setStatus("on");
            setMessage("Meldingen staan aan.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Aanzetten mislukt");
        } finally {
            setBusy(false);
        }
    };

    const update = async (next: Preferences) =>
    {
        setPrefs(next);
        if (status !== "on") return;
        try {
            const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
            if (subscription) await save(subscription, next);
            setMessage("Voorkeuren opgeslagen.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Opslaan mislukt");
        }
    };

    const disable = async () =>
    {
        setBusy(true);
        try {
            const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
            if (subscription) {
                await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
                await subscription.unsubscribe();
            }
            setStatus("off");
            setMessage("Meldingen staan uit.");
        } finally {
            setBusy(false);
        }
    };

    const options = (
        <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 text-sm">
                <span>Dagoverzicht zodra de prijzen van morgen bekend zijn <span className="text-muted-foreground">(± 15:00)</span></span>
                <Switch checked={prefs.digest} onCheckedChange={(digest) => update({ ...prefs, digest })} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
                <span>Waarschuwing vóór negatieve prijzen</span>
                <Switch checked={prefs.negative} onCheckedChange={(negative) => update({ ...prefs, negative })} />
            </label>
            <div className="flex items-center justify-between gap-4 text-sm">
                <label htmlFor="threshold" className="flex-1">Als stroom onder</label>
                <Input
                    id="threshold"
                    inputMode="decimal"
                    className="h-8 w-20"
                    value={thresholdText}
                    disabled={!prefs.thresholdEnabled}
                    onChange={(e) => setThresholdText(e.target.value)}
                    onBlur={() =>
                    {
                        const value = Number(thresholdText.replace(",", "."));
                        if (Number.isFinite(value)) update({ ...prefs, threshold: value });
                    }}
                    aria-label="Prijsgrens in euro per kWh"
                />
                <span className="text-muted-foreground">€/kWh</span>
                <Switch checked={prefs.thresholdEnabled} onCheckedChange={(thresholdEnabled) => update({ ...prefs, thresholdEnabled })} aria-label="Prijsgrens gebruiken" />
            </div>
        </div>
    );

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="size-4 text-muted-foreground" aria-hidden />Meldingen</CardTitle>
                <CardDescription>Een seintje op je telefoon of computer, met jouw prijsinstellingen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {status === "loading" && <p className="text-sm text-muted-foreground">Even kijken wat je browser ondersteunt…</p>}
                {status === "unsupported" && <p className="text-sm text-muted-foreground">Deze browser ondersteunt geen pushmeldingen. Gebruik de agenda-koppeling hiernaast als alternatief.</p>}
                {status === "ios-install" && (
                    <p className="text-sm text-muted-foreground">
                        Op iPhone en iPad werken meldingen alleen vanaf het beginscherm: tik op <span className="font-medium text-foreground">Deel</span> → <span className="font-medium text-foreground">Zet op beginscherm</span> en open Energy Wise daarvandaan.
                    </p>
                )}
                {status === "unconfigured" && <p className="text-sm text-muted-foreground">Meldingen zijn op deze server nog niet ingesteld.</p>}
                {status === "denied" && <p className="text-sm text-muted-foreground">Je hebt meldingen voor deze site geblokkeerd. Sta ze toe via de site-instellingen van je browser.</p>}
                {(status === "off" || status === "on") && options}
                {status === "off" && <Button onClick={enable} disabled={busy}><Bell />{busy ? "Bezig…" : "Meldingen aanzetten"}</Button>}
                {status === "on" && <Button variant="outline" onClick={disable} disabled={busy}><BellOff />Meldingen uitzetten</Button>}
                {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
            </CardContent>
        </Card>
    );
}
