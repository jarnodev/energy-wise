"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const NEXT = { system: "light", light: "dark", dark: "system" } as const;
const LABEL = { system: "Thema: systeem", light: "Thema: licht", dark: "Thema: donker" } as const;

// Cycles system -> light -> dark
export function ThemeToggler()
{
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const current = (mounted ? theme : "system") as keyof typeof NEXT;
    const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

    return (
        <Button variant="ghost" size="icon" onClick={() => setTheme(NEXT[current] ?? "system")} aria-label={LABEL[current]} title={LABEL[current]}>
            <Icon className="size-5" />
        </Button>
    );
}
