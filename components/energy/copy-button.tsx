"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Kopieer" }: { text: string; label?: string })
{
    const [copied, setCopied] = useState(false);

    const copy = async () =>
    {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard blocked; the text is visible to copy by hand
        }
    };

    return (
        <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Gekopieerd" : label}
        </Button>
    );
}
