"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PRICE_SETTINGS, PriceSettings } from "@/lib/pricing";
import { DEFAULT_LOCATION } from "@/lib/solar";

export type Settings = {
    price: PriceSettings;
    blockMinutes: number; // Duration of the "cheapest block" the user is looking for
    granularity: "quarter" | "hour";
    location: { name: string; latitude: number; longitude: number };
    solar: { peakPower: number; tilt: number; azimuth: number }; // peakPower in kWp, 0 = no panels
};

export const DEFAULT_SETTINGS: Settings = {
    price: DEFAULT_PRICE_SETTINGS,
    blockMinutes: 120,
    granularity: "quarter",
    location: DEFAULT_LOCATION,
    solar: { peakPower: 0, tilt: 35, azimuth: 0 },
};

const STORAGE_KEY = "energy-wise:settings";

type SettingsContextValue = {
    settings: Settings;
    update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: () => { } });

// Merges stored settings over the defaults, so new fields get their default value
function load(): Settings
{
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Settings> | null;
        if (!stored) return DEFAULT_SETTINGS;
        return {
            ...DEFAULT_SETTINGS,
            ...stored,
            price: { ...DEFAULT_SETTINGS.price, ...stored.price },
            location: { ...DEFAULT_SETTINGS.location, ...stored.location },
            solar: { ...DEFAULT_SETTINGS.solar, ...stored.solar },
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function SettingsProvider({ children }: { children: React.ReactNode })
{
    // Defaults on the server and first client render, stored settings right after hydration
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    useEffect(() => setSettings(load()), []);

    const update = useCallback((patch: Partial<Settings>) =>
    {
        setSettings((current) =>
        {
            const next = { ...current, ...patch };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Storage unavailable (private mode), settings still apply for this visit
            }
            return next;
        });
    }, []);

    const value = useMemo(() => ({ settings, update }), [settings, update]);
    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings()
{
    return useContext(SettingsContext);
}

// Current time, refreshed every 30 seconds. Starts at the server render time to keep hydration consistent.
export function useNow(initial: number): number
{
    const [now, setNow] = useState(initial);
    useEffect(() =>
    {
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
    }, []);
    return now;
}
