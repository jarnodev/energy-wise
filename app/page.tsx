import ChartAreaInteractive from "@/components/chart-area-interactive";
import { ChartConfig } from "@/components/ui/chart";
import { ThemeToggler } from "@/components/theme-toggler";
import { Zap } from "lucide-react";

export const runtime = "edge";

const API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

const defaultDates = () =>
{
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const tillDate = new Date();
  tillDate.setDate(tillDate.getDate() + 1);
  tillDate.setHours(23, 59, 59, 999);
  return {
    formattedFromDate: fromDate.toISOString().split("T")[0],
    formattedTillDate: tillDate.toISOString().split("T")[0],
  };
}

async function fetchChartData(fromDate: string, tillDate: string): Promise<{
  energyPricesData: { prices: Array<{ date: string; value: number }> };
  gasPricesData: { prices: Array<{ date: string; value: number }> };
  sunData: { sunshineDurations: Array<{ readingDate: string; duration: number }> };
}>
{
  const [energyPricesResponse, gasPricesResponse, sunResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/api/energy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, tillDate, interval: 4, vat: true }),
    }),
    fetch(`${API_BASE_URL}/api/gas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate, tillDate, interval: 4, vat: true }),
    }),
    fetch(`${API_BASE_URL}/api/sun`, { method: "GET" }),
  ]);

  if (!energyPricesResponse.ok || !gasPricesResponse.ok || !sunResponse.ok) {
    throw new Error("Failed to fetch data");
  }

  const energyPricesData = await energyPricesResponse.json() as { prices: Array<{ date: string; value: number }> };
  const gasPricesData = await gasPricesResponse.json() as { prices: Array<{ date: string; value: number }> };
  const sunData = await sunResponse.json() as { sunshineDurations: Array<{ readingDate: string; duration: number }> };
  return { energyPricesData, gasPricesData, sunData };
}

function getEnergyGasChartConfig(): ChartConfig
{
  return {
    date: { label: "Date" },
    value: { label: "Price (EUR)", color: "hsl(210, 100%, 50%)" },
  };
}

function renderHeader()
{
  return (
    <section className="relative flex flex-col items-start justify-center p-8 bg-white/30 backdrop-blur-md border-b border-white/30 shadow-lg rounded-b-3xl overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-br from-blue-400/40 via-white/10 to-blue-700/30" />
      <div className="relative z-10 flex flex-col items-start">
        <h1 className="text-4xl font-extrabold mb-3 text-white/80 tracking-tight">
          Energy Wise <Zap className="inline-block w-7 h-7 ml-2 text-yellow-300 drop-shadow-glow" />
        </h1>
        <span className="text-base font-light text-white/70 drop-shadow">
          Track the variable cost of energy and gas in the Netherlands
        </span>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 60% 40%, rgba(0,180,255,0.35) 0%, rgba(255,255,255,0.10) 60%, transparent 100%), radial-gradient(ellipse at 20% 80%, rgba(255,200,0,0.18) 0%, transparent 70%)",
          mixBlendMode: "lighten",
        }}
      />
    </section>
  );
}

function renderCharts(
  energyPricesData: { prices: Array<{ date: string; value: number }> },
  gasPricesData: { prices: Array<{ date: string; value: number }> },
  sunData: { sunshineDurations: Array<{ readingDate: string; duration: number }> },
  chartConfig: ChartConfig
)
{
  return (
    <main className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 p-4 sm:p-8 mx-auto w-full">
      <div>
        <ChartAreaInteractive
          chartData={energyPricesData.prices}
          chartConfig={chartConfig}
          chartName="Energy Prices"
          chartDescription="Electricity price trends for the year."
        />
      </div>
      <div>
        <ChartAreaInteractive
          chartData={gasPricesData.prices}
          chartConfig={chartConfig}
          chartName="Gas Prices"
          chartDescription="Gas price trends for the year."
        />
      </div>
      <div>
        <ChartAreaInteractive
          chartData={sunData.sunshineDurations.map((d: { readingDate: string; duration: number }) => ({ date: d.readingDate, duration: d.duration / 60 }))}
          chartConfig={{ date: { label: "Time" }, duration: { label: "Sunshine (min)", color: "hsl(45, 100%, 50%)" } }}
          chartName="Sunshine Duration"
          chartDescription="Recent sunshine duration (minutes per hour)."
        />
      </div>
    </main>
  );
}

export default async function Home()
{
  const { formattedFromDate, formattedTillDate } = defaultDates();
  const { energyPricesData, gasPricesData, sunData } = await fetchChartData(formattedFromDate, formattedTillDate);
  const chartConfig = getEnergyGasChartConfig();

  return (
    <div className="bg-background text-foreground">
      {renderHeader()}
      <ThemeToggler />
      {renderCharts(energyPricesData, gasPricesData, sunData, chartConfig)}
    </div>
  );
}
