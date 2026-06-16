"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { SqlEditor } from "@/components/query/sql-editor";
import { ResultsTable } from "@/components/query/results-table";
import { DatasetPicker } from "@/components/query/dataset-picker";
import { MaterializeDialog } from "@/components/query/materialize-dialog";
import { QueryHistory } from "@/components/query/query-history";
import { ApiError } from "@/lib/api-client";
import { useRunQuery } from "@/lib/queries";

const STARTER_SQL =
  "-- Pick a dataset above to insert its s3:// path, then run.\nSELECT 1 AS hello, 'world' AS msg;";

export default function QueryPage() {
  const [sql, setSql] = useState(STARTER_SQL);
  const runQuery = useRunQuery();

  const handleRun = () => {
    runQuery.mutate(
      { sql },
      {
        onError: (err) => {
          const detail =
            err instanceof ApiError ? err.message : "Query failed";
          toast.error(detail);
        },
      },
    );
  };

  // Insert a dataset reader snippet at the end of the current SQL.
  const insertSnippet = (snippet: string) => {
    setSql((prev) => {
      const base = prev.trim();
      return base ? `${base}\n-- ${snippet}` : `SELECT * FROM ${snippet} LIMIT 100;`;
    });
    toast.message("Dataset path inserted into the editor");
  };

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">SQL Console</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Run SQL directly against files in your B2 bucket with DuckDB — no
          ETL, no warehouse. Reads stream only the row groups they need.
        </p>
      </div>

      <Card className="animate-fade-in-up stagger-1">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4 px-5 space-y-0">
          <CardTitle className="card-title">Query</CardTitle>
          <div className="flex items-center gap-2">
            <DatasetPicker onPick={insertSnippet} />
            <MaterializeDialog sql={sql} disabled={!sql.trim()} />
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <SqlEditor
            value={sql}
            onChange={setSql}
            onRun={handleRun}
            running={runQuery.isPending}
          />
        </CardContent>
      </Card>

      <div className="animate-fade-in-up stagger-2">
        {runQuery.isError ? (
          <ErrorState
            error={runQuery.error}
            onRetry={handleRun}
          />
        ) : runQuery.data ? (
          <Card>
            <CardHeader className="border-b border-border py-4 px-5">
              <CardTitle className="card-title">Result</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <ResultsTable result={runQuery.data} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="animate-fade-in-up stagger-3">
        <QueryHistory onSelect={setSql} />
      </div>
    </div>
  );
}
