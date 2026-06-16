import { ResultsLibrary } from "@/components/results/results-library";

export default function ResultsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Results</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Parquet slices you materialized to{" "}
          <code className="font-mono text-xs">query-results/</code> in your B2
          bucket. Download any slice for training or reporting.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <ResultsLibrary />
      </div>
    </div>
  );
}
