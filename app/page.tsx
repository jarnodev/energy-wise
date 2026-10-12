import ChartAreaInteractive from "@/components/chart-area-interactive";
import { ChartConfig } from "@/components/ui/chart";
import { Zap } from "lucide-react";
import { amsterdamDayOffset } from "@/lib/dates";
import { getPrices, getSunshine } from "@/lib/energy-data";

// Prices change daily and the date range depends on today, so always render on request
export const dynamic = "force-dynamic";

const defaultDates = () =>
{
  // Last 30 days up to and including tomorrow, as calendar days in Dutch local time
  return {
    formattedFromDate: amsterdamDayOffset(-29),
    formattedTillDate: amsterdamDayOffset(1),
  };
}

async function fetchChartData(fromDate: string, tillDate: string)
{
  const [energyPricesData, gasPricesData, sunData] = await Promise.all([
    getPrices("energy", { fromDate, tillDate, interval: 4, vat: true }),
    getPrices("gas", { fromDate, tillDate, interval: 4, vat: true }),
    getSunshine(),
  ]);
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
    <section className="relative flex flex-col items-start justify-center p-8 shadow-lg rounded-b-3xl overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-br from-blue-400 to-blue-700" />
      <div className="relative z-10 flex flex-col items-start">
        <h1 className="text-4xl font-extrabold mb-3 text-white tracking-tight">
          Energy Wise <Zap className="inline-block w-7 h-7 ml-2 text-yellow-300 drop-shadow-glow" />
        </h1>
        <span className="text-base font-light text-white drop-shadow">
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
    <main className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3 p-4 sm:p-8 mx-auto w-full">
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
      {renderCharts(energyPricesData, gasPricesData, sunData, chartConfig)}
    </div>
  );
}
