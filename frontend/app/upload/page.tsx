"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import { deleteDocument, getErrorMessage, listDocuments, uploadDocument } from "@/lib/api";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { StoredDocument } from "@/lib/types";

const MAX_MB = 5;

export default function UploadPage() {
  useRequireAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<StoredDocument[]>([]);

  const loadDocuments = useCallback(async () => {
    try {
      setDocuments(await listDocuments());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your documents."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the request resolves
    loadDocuments();
  }, [loadDocuments]);

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

  const handleUpload = async () => {
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
      await loadDocuments();
    } catch (err) {
      setError(getErrorMessage(err, "Upload failed. Please try again."));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: StoredDocument) => {
    if (!window.confirm(`Delete ${doc.filename}?`)) return;
    try {
      await deleteDocument(doc.id);
      await loadDocuments();
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete document."));
    }
  };

  return (
    <PageLayout>
      <div className="px-8 py-8 max-w-3xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Financial Documents</h1>
          <p className="text-gray-400 mt-1">
            Upload documents the AI can&apos;t find on its own, such as research reports or notes on a company. They are
            used as cited evidence when you ask about a company they mention.
          </p>
          <div className="mt-3 bg-teal-950 border border-teal-800 rounded-lg px-4 py-3 text-teal-200 text-sm">
            No need to upload public filings: 10-K and 10-Q reports for US-listed companies are fetched
            automatically from SEC EDGAR and cited in every stock analysis.
          </div>
        </div>

        {/* Upload box */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 mb-6">
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center hover:border-teal-500 transition cursor-pointer"
            onClick={() => fileInput.current?.click()}
          >
            <p className="text-4xl mb-3">📄</p>
            <p className="text-white font-semibold mb-1">
              {file ? file.name : "Click to select a document"}
            </p>
            <p className="text-gray-500 text-sm">
              PDF, TXT, or CSV · up to {MAX_MB} MB · text-based PDFs only (no scans)
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt,.csv"
              className="hidden"
              onChange={(e) => selectFile(e.target.files?.[0] || null)}
            />
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
              <div>
                <p className="text-white text-sm font-semibold">{file.name}</p>
                <p className="text-gray-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => selectFile(null)}
                className="text-gray-500 hover:text-red-400 transition text-sm"
              >
                Remove
              </button>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full mt-4 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>

          {message && (
            <div className="mt-4 bg-green-950 border border-green-800 rounded-lg p-4">
              <p className="text-green-300 text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-950 border border-red-800 rounded-lg p-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Stored documents */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Your documents</h2>
          {documents.length === 0 ? (
            <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-semibold">{doc.filename}</p>
                    <p className="text-gray-400 text-xs">
                      {doc.size_kb} KB · uploaded {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="text-gray-500 hover:text-red-400 transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-white mb-4">How it works</h2>
          <div className="space-y-4">
            {[
              { step: "1", title: "Upload", desc: "The text of your document is extracted and stored, linked to your account only" },
              { step: "2", title: "Search", desc: "When you ask about a stock, the AI finds passages that mention that company or ticker" },
              { step: "3", title: "Answer", desc: "The Evidence Agent includes those passages as a cited source in its analysis" },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{item.title}</p>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
