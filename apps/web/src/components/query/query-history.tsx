"use client";

import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useQueryHistory } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

interface QueryHistoryProps {
  /** Click a past query to load its SQL back into the editor. */
  onSelect: (sql: string) => void;
}

export function QueryHistory({ onSelect }: QueryHistoryProps) {
  const { data: history = [], isLoading, error, refetch } = useQueryHistory();

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Materialized queries</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : history.length === 0 ? (
          <EmptyState
            icon={History}
            title="No saved queries yet"
            description="Materialize a query result to see it here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((q) => (
              <li key={q.id}>
                <button
                  onClick={() => onSelect(q.sql)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-accent/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{q.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {q.sql}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {q.rows_written} rows
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(q.created_at)}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
