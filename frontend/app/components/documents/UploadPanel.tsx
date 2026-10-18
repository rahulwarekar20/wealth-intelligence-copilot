"use client";

/**
 * Drop-zone style picker and upload button for private documents
 * (PDF / TXT / CSV, up to MAX_MB). Calls `onUploaded` after a successful
 * upload so the page can refresh its document list.
 */
import { useRef, useState } from "react";
import { getErrorMessage, uploadDocument } from "@/lib/api";
import Callout from "../ui/Callout";
import { IconUpload } from "../ui/Icons";

const MAX_MB = 5;
const ACCEPTED = ".pdf,.txt,.csv";

export default function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /** Accepts a picked file, rejecting anything over the size limit. */
  const selectFile = (selected: File | null) => {
    setMessage("");
    setError("");
    if (selected && selected.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      setError(`File is larger than ${MAX_MB} MB.`);
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage("");
    setError("");
    try {
      const doc = await uploadDocument(file);
      setMessage(
        `${doc.filename} stored (${doc.characters.toLocaleString()} characters of text). ` +
          "The Evidence Agent will cite it when you ask about a company it mentions."
      );
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      onUploaded();
    } catch (err) {
      setError(getErrorMessage(err, "Upload failed. Please try again."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card p-8">
      {/* Clickable drop zone */}
      <div
        className="group cursor-pointer rounded-xl border-2 border-dashed border-paper-400 bg-paper-100/60 p-10 text-center transition hover:border-gold-400 hover:bg-gold-50/50"
        onClick={() => fileInput.current?.click()}
      >
        <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-paper-300 bg-paper-50 text-gold-500 shadow-card transition group-hover:-translate-y-0.5">
          <IconUpload size={24} />
        </span>
        <p className="mb-1 font-display text-lg text-ink-900">{file ? file.name : "Click to select a document"}</p>
        <p className="text-sm text-ink-500">PDF, TXT, or CSV · up to {MAX_MB} MB · text-based PDFs only (no scans)</p>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => selectFile(e.target.files?.[0] || null)}
        />
      </div>

      {/* Selected file */}
      {file && (
        <div className="card-inset mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">{file.name}</p>
            <p className="text-xs text-ink-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={() => selectFile(null)} className="text-sm text-ink-500 transition hover:text-brick-500">
            Remove
          </button>
        </div>
      )}

      <button onClick={upload} disabled={!file || uploading} className="btn-primary mt-4 w-full rounded-xl py-3">
        {uploading ? "Uploading..." : "Upload Document"}
      </button>

      {message && <Callout tone="success" className="mt-4">{message}</Callout>}
      {error && <Callout tone="error" className="mt-4">{error}</Callout>}
    </div>
  );
}
