"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useQueryHistory } from "@/lib/queries";

const chartConfig = {
  queries: {
    label: "Queries",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const DAYS = 7;

/**
 * Materialized-queries-over-time. Buckets the durable query history by day
 * over the last week. Replaces the starter kit's upload-activity chart.
 */
export function QueryChart() {
  const { data: history = [], error, refetch } = useQueryHistory();

  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts = new Map<string, number>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      counts.set(d.toISOString().slice(0, 10), 0);
    }
    for (const q of history) {
      const key = new Date(q.created_at).toISOString().slice(0, 10);
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([iso, queries]) => ({
      date: new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      queries,
    }));
  }, [history]);

  const total = data.reduce((sum, d) => sum + d.queries, 0);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Query Activity</CardTitle>
        <CardDescription className="text-xs">
          Materialized queries · last 7 days
        </CardDescription>
        <CardAction className="text-right self-center">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total
          </div>
          <div className="text-lg font-semibold tabular-nums tracking-tight leading-tight">
            {total}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-5">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : total === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No queries yet"
            description="Materialize a query to see activity trends here."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="queries-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-queries)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-queries)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                fontSize={11}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                width={28}
              />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="queries"
                fill="url(#queries-fill)"
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
