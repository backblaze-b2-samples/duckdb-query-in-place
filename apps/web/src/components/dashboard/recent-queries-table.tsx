"use client";

import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useQueryHistory } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export function RecentQueriesTable() {
  const { data: history = [], isLoading, error, refetch } = useQueryHistory(10);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent Queries</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/results"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View results
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : history.length === 0 ? (
          <EmptyState
            icon={History}
            title="No queries yet"
            description="Head to the SQL Console to run your first query."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[30%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="w-[36%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  SQL
                </TableHead>
                <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rows
                </TableHead>
                <TableHead className="w-[20%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  When
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((q) => (
                <TableRow key={q.id} className="table-row-hover">
                  <TableCell className="font-medium">
                    <div className="truncate">{q.name}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <div className="truncate">{q.sql}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {q.rows_written}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(q.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
