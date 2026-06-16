"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { useMaterialize } from "@/lib/queries";

interface MaterializeDialogProps {
  /** The SQL whose result will be written to B2. */
  sql: string;
  /** Disabled until there's a query to materialize. */
  disabled: boolean;
}

/**
 * "Save to B2" action: runs the current SQL as a COPY ... TO and writes the
 * full result to `query-results/<slug>.parquet`. The destination is built
 * server-side from the name — the user only supplies a label.
 */
export function MaterializeDialog({ sql, disabled }: MaterializeDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const materialize = useMaterialize();

  const onSave = () => {
    materialize.mutate(
      { sql, name: name.trim() || "result" },
      {
        onSuccess: (saved) => {
          toast.success(
            `Saved ${saved.rows_written} rows to ${saved.result_key}`,
          );
          setOpen(false);
          setName("");
        },
        onError: (err) => {
          const detail =
            err instanceof ApiError ? err.message : "Materialize failed";
          toast.error(detail);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8" disabled={disabled}>
          <Save className="h-3.5 w-3.5" />
          Materialize to B2
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Materialize result to B2</DialogTitle>
          <DialogDescription>
            Writes the full query result to a Parquet slice under{" "}
            <code className="font-mono">query-results/</code> in your bucket.
            It appears in the Results Library.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="result-name">Name</Label>
          <Input
            id="result-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="active-users-last-30d"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Sanitized server-side into a safe object key.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={materialize.isPending}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={materialize.isPending}>
            {materialize.isPending ? "Saving…" : "Save to B2"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
