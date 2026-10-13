import { Dashboard } from "@/components/energy/dashboard";
import { amsterdamDayOffset } from "@/lib/dates";
import { getLatestSummary, getPricePoints } from "@/lib/prices";

// Prices change daily and the date range depends on today, so always render on request
export const dynamic = "force-dynamic";

export default async function Home()
{
  // Last 30 days up to and including tomorrow, as calendar days in Dutch local time
  const from = amsterdamDayOffset(-30);
  const till = amsterdamDayOffset(1);

  const [electricity, gas, summary] = await Promise.all([
    getPricePoints("electricity", from, till).catch(() => []),
    getPricePoints("gas", from, till).catch(() => []),
    getLatestSummary(),
  ]);

  if (!electricity.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Prijzen tijdelijk niet beschikbaar</h1>
        <p className="text-muted-foreground">De prijsbron reageert niet. Probeer het over een paar minuten opnieuw.</p>
      </main>
    );
  }

  return <Dashboard electricity={electricity} gas={gas} summary={summary} renderedAt={Date.now()} />;
}
