"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
}

/**
 * Plain textarea SQL input. Cmd/Ctrl+Enter runs the query — the same
 * shortcut every SQL console uses, so it feels native without pulling in a
 * heavyweight code-editor dependency.
 */
export function SqlEditor({ value, onChange, onRun, running }: SqlEditorProps) {
  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            if (!running && value.trim()) onRun();
          }
        }}
        placeholder="SELECT * FROM read_parquet('s3://your-bucket/datasets/events.parquet') LIMIT 100"
        spellCheck={false}
        className="font-mono text-sm min-h-[160px] resize-y"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Read-only. Reference files with{" "}
          <code className="font-mono">s3://&lt;bucket&gt;/&lt;key&gt;</code>.{" "}
          <kbd className="rounded border px-1 text-[10px]">⌘/Ctrl</kbd>+
          <kbd className="rounded border px-1 text-[10px]">Enter</kbd> to run.
        </p>
        <Button
          size="sm"
          onClick={onRun}
          disabled={running || !value.trim()}
          className="h-8"
        >
          <Play className="h-3.5 w-3.5" />
          {running ? "Running…" : "Run query"}
        </Button>
      </div>
    </div>
  );
}
