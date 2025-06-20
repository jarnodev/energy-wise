"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import
{
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import
{
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart'
import
{
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export interface ChartAreaInteractiveProps
{
    chartData: Array<{ date: string;[value: string]: number | string }>
    chartConfig: ChartConfig
    chartName?: string
    chartDescription?: string
}

function getFilteredData(chartData: Array<{ date: string;[value: string]: number | string }>, timeRange: string)
{
    if (!chartData.length) return [];
    const referenceDate = new Date(chartData[chartData.length - 1]?.date || Date.now());
    const today = new Date();
    const getDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    return chartData.filter((item) =>
    {
        const date = new Date(item.date);
        switch (timeRange) {
            case "0d": {
                // Today
                return getDateOnly(date).getTime() === getDateOnly(today).getTime();
            }
            case "1d": {
                // Yesterday
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                return getDateOnly(date).getTime() === getDateOnly(yesterday).getTime();
            }
            case "-1d": {
                // Tomorrow
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                return getDateOnly(date).getTime() === getDateOnly(tomorrow).getTime();
            }
            case "7d":
            case "30d": {
                // Last 7 or 30 days
                const daysToSubtract = timeRange === "7d" ? 7 : 30;
                const startDate = new Date(referenceDate);
                startDate.setDate(referenceDate.getDate() - daysToSubtract);
                return date >= startDate;
            }
            default:
                return true;
        }
    });
}

export default function ChartAreaInteractive({ chartData, chartConfig, chartName, chartDescription }: ChartAreaInteractiveProps)
{
    const [timeRange, setTimeRange] = React.useState("0d")
    const [timeRanges] = React.useState([
        { value: "30d", label: "Last 30 days" },
        { value: "7d", label: "Last 7 days" },
        { value: "1d", label: "Yesterday" },
        { value: "0d", label: "Today" },
        { value: "-1d", label: "Tomorrow" },
    ])

    const filteredData = getFilteredData(chartData, timeRange)

    return (
        <Card>
            <CardHeader className="flex items-center gap-2 space-y-0 border-b sm:flex-row">
                <div className="grid flex-1 gap-1 text-center sm:text-left">
                    <CardTitle>
                        {chartName || "Interactive Area Chart"}
                    </CardTitle>
                    <CardDescription>
                        {chartDescription || "This chart displays the data over the selected time range."}
                    </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger
                        className="w-[160px] rounded-lg sm:ml-auto"
                        aria-label="Select a value"
                    >
                        <SelectValue placeholder="Last 3 months" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {timeRanges.map((range) => (
                            <SelectItem
                                key={range.value}
                                value={range.value}
                                className="rounded-lg"
                            >
                                {range.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <AreaChart data={filteredData}>
                        <defs>
                            <linearGradient id={`fill-${Object.keys(chartConfig)[1]}`} x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor={`var(--color-${Object.keys(chartConfig)[1]})`}
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor={`var(--color-${Object.keys(chartConfig)[1]})`}
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey={Object.keys(chartConfig)[0]}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) =>
                            {
                                const date = new Date(value)
                                if (timeRange === "0d" || timeRange === "1d" || timeRange === "-1d") {
                                    return date.toLocaleTimeString("en-GB", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: false,
                                    })
                                }
                                return date.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                })
                            }}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) =>
                                    {
                                        const date = new Date(value)
                                        if (timeRange === "0d" || timeRange === "1d" || timeRange === "-1d") {
                                            return date.toLocaleTimeString("en-GB", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: false,
                                            })
                                        }
                                        return date.toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey={Object.keys(chartConfig)[1]}
                            type="natural"
                            fill={`url(#fill-${Object.keys(chartConfig)[1]})`}
                            stroke={`var(--color-${Object.keys(chartConfig)[1]})`}
                            stackId="a"
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
