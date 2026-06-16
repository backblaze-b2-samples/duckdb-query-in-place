export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
  total_datasets: number;
  total_results: number;
  total_queries: number;
}

// --- Query-in-place ---

export interface QueryRequest {
  sql: string;
  max_rows?: number | null;
}

export interface QueryResult {
  columns: string[];
  // Cells are JSON primitives once they reach the browser (the API
  // stringifies non-native types like dates/decimals at the boundary).
  rows: Array<Array<string | number | boolean | null>>;
  row_count: number;
  truncated: boolean;
  duration_ms: number;
}

export interface MaterializeRequest {
  sql: string;
  name: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  result_key: string;
  rows_written: number;
  created_at: string;
}
