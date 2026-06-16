"use client";

import { Download, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ApiError, getDownloadUrl } from "@/lib/api-client";
import { useFiles } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

const RESULT_PREFIX = "query-results/";

/**
 * Sample-scoped asset explorer for materialized query results. Unlike the
 * full-bucket Files tree, this lists only `query-results/*` Parquet slices
 * and offers a presigned download for each.
 */
export function ResultsLibrary() {
  const {
    data: files = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useFiles(RESULT_PREFIX, 1000);

  // The API may return objects outside the prefix if the bucket is small;
  // scope strictly to query-results/ here.
  const results = files.filter((f) => f.key.startsWith(RESULT_PREFIX));

  const handleDownload = async (key: string) => {
    try {
      const { url } = await getDownloadUrl(key);
      window.open(url, "_blank");
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.message : "Failed to get download URL";
      toast.error(detail);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4 px-5 space-y-0">
        <CardTitle className="card-title">Result slices</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-7 text-xs"
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No materialized results yet"
            description="Run a query in the SQL Console and click Materialize to B2."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[48%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Result
                </TableHead>
                <TableHead className="w-[16%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Size
                </TableHead>
                <TableHead className="w-[24%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Created
                </TableHead>
                <TableHead className="w-[12%] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Download
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((f) => (
                <TableRow key={f.key} className="table-row-hover">
                  <TableCell className="font-medium">
                    <div className="truncate">{f.filename}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {f.size_human}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(f.uploaded_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(f.key)}
                      aria-label={`Download ${f.filename}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
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
