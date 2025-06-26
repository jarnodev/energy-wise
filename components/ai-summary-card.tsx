"use client";

import React, { useState } from "react";
import Markdown from "react-markdown";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AiSummaryCard()
{
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = async () =>
    {
        setLoading(true);
        setError(null);
        setSummary(null);
        try {
            // FromDate defautl to 30 days ago, TillDate default to today
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 30);
            const tillDate = new Date();
            tillDate.setDate(tillDate.getDate() + 1);
            tillDate.setHours(23, 59, 59, 999);
            const formattedFromDate = fromDate.toISOString().split("T")[0];
            const formattedTillDate = tillDate.toISOString().split("T")[0];

            const res = await fetch("/api/ai-summary", {
                method: "POST", body: JSON.stringify({
                    fromDate: formattedFromDate,
                    tillDate: formattedTillDate,
                }),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) throw new Error("Failed to fetch summary");

            const data: { summary: string } = await res.json();

            setSummary(data.summary);
        } catch (e: unknown) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError("Unknown error");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full mx-auto my-8">
            <CardHeader>
                <CardTitle>AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
                {error && <div className="text-destructive mb-2">{error}</div>}
                {summary ? (
                    <Markdown>{summary}</Markdown>
                ) : (
                    <div className="text-muted-foreground text-sm mb-2">
                        Click the button below to generate a summary of the latest energy, gas, and sun pricing/data.
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button onClick={fetchSummary} disabled={loading}>
                    {loading ? "Loading..." : "Get AI Summary"}
                </Button>
            </CardFooter>
        </Card>
    );
}
