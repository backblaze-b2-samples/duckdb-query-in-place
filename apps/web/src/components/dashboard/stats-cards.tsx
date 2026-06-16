"use client";

import { Table2, HardDrive, Database, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useFileStats } from "@/lib/queries";

export function StatsCards() {
  const { data: stats, isLoading, error, refetch } = useFileStats();

  // Surface fetch failures inline rather than rendering "0 files / 0 B" —
  // that lies to the user about the bucket state when really the API is
  // just unreachable.
  if (error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={error} onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { title: "Datasets", value: stats?.total_datasets ?? 0, icon: Table2 },
    { title: "Result Slices", value: stats?.total_results ?? 0, icon: Database },
    { title: "Queries Run", value: stats?.total_queries ?? 0, icon: Terminal },
    { title: "Bucket Size", value: stats?.total_size_human ?? "0 B", icon: HardDrive },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Card
          key={card.title}
          className={`card-hover animate-fade-in-up stagger-${i + 1}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className="stat-icon-wrap">
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-5 px-4">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="stat-value">{card.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
