"use client";

import { useQuery } from "@tanstack/react-query";
import { Table2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHealth } from "@/lib/api-client";
import { useFiles, qk } from "@/lib/queries";

interface DatasetPickerProps {
  /** Called with a ready-to-run `read_*('s3://...')` snippet for the picked file. */
  onPick: (snippet: string) => void;
}

/** Build the right DuckDB reader for a file based on its extension. */
function readerFor(bucket: string, key: string): string {
  const path = `s3://${bucket}/${key}`;
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "parquet") return `read_parquet('${path}')`;
  if (ext === "json" || ext === "ndjson" || ext === "jsonl") {
    return `read_json_auto('${path}')`;
  }
  // CSV / TSV / txt — let DuckDB sniff the dialect.
  return `read_csv_auto('${path}')`;
}

/**
 * Lists objects under `datasets/` and, on selection, hands the SQL editor a
 * ready-to-run reader snippet pointing at the file's `s3://` path. The
 * bucket name comes from `/health` (it's not a secret — the key is).
 */
export function DatasetPicker({ onPick }: DatasetPickerProps) {
  const { data: health } = useQuery({
    queryKey: [...qk.all, "health-bucket"],
    queryFn: getHealth,
    staleTime: 5 * 60_000,
  });
  const { data: files = [] } = useFiles("datasets/", 1000);

  const bucket = health?.bucket ?? "your-bucket";
  const datasets = files.filter((f) => f.key.startsWith("datasets/"));

  return (
    <Select
      onValueChange={(key) => onPick(readerFor(bucket, key))}
      value=""
    >
      <SelectTrigger className="h-8 w-[260px] text-xs">
        <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue placeholder="Insert a dataset…" />
      </SelectTrigger>
      <SelectContent>
        {datasets.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No datasets yet — upload one first.
          </div>
        ) : (
          datasets.map((f) => (
            <SelectItem key={f.key} value={f.key} className="text-xs">
              {f.filename}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
