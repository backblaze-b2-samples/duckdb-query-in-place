"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { QueryResult } from "@duckdb-query-in-place/shared";

type Row = Record<string, string | number | boolean | null>;

interface ResultsTableProps {
  result: QueryResult;
}

/**
 * Renders a query's row preview in the shared sortable/paginated DataTable.
 * DuckDB returns rows as positional arrays; we zip them with the column
 * names into objects so the generic table can key cells by column.
 */
export function ResultsTable({ result }: ResultsTableProps) {
  const { columns, data } = useMemo(() => {
    const cols: ColumnDef<Row>[] = result.columns.map((name) => ({
      accessorKey: name,
      header: name,
      cell: ({ getValue }) => {
        const v = getValue();
        if (v === null) {
          return <span className="text-muted-foreground italic">null</span>;
        }
        return <span className="font-mono text-xs">{String(v)}</span>;
      },
    }));
    const rows: Row[] = result.rows.map((arr) => {
      const obj: Row = {};
      result.columns.forEach((name, i) => {
        obj[name] = arr[i] ?? null;
      });
      return obj;
    });
    return { columns: cols, data: rows };
  }, [result]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {result.row_count} row{result.row_count === 1 ? "" : "s"}
          {result.truncated ? " (preview truncated)" : ""}
        </span>
        <span className="tabular-nums">{result.duration_ms} ms</span>
      </div>
      <DataTable
        columns={columns}
        data={data}
        pageSize={25}
        emptyTitle="No rows"
        emptyDescription="This query returned no rows."
      />
    </div>
  );
}
