"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "../components/PageLayout";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://localhost:8000/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        setMessage(`${file.name} uploaded successfully. The AI will now use this document as evidence when you ask questions.`);
        setFile(null);
      } else {
        setError("Upload failed. Please try again.");
      }
    } catch (err) {
      setError("Upload failed. Make sure the backend is running.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageLayout>
      <div className="px-8 py-8 max-w-3xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Financial Documents</h1>
          <p className="text-gray-400 mt-1">
            Upload annual reports, portfolio statements, or 10-Ks. The AI will use them as evidence when answering your questions.
          </p>
        </div>

        {/* Upload box */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 mb-6">
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center hover:border-teal-500 transition cursor-pointer"
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <p className="text-4xl mb-3">📄</p>
            <p className="text-white font-semibold mb-1">
              {file ? file.name : "Click to select a document"}
            </p>
            <p className="text-gray-500 text-sm">
              Supports PDF, TXT, and CSV files
            </p>
            <input
              id="fileInput"
              type="file"
              accept=".pdf,.txt,.csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setMessage("");
                setError("");
              }}
            />
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
              <div>
                <p className="text-white text-sm font-semibold">{file.name}</p>
                <p className="text-gray-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => setFile(null)}
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

        {/* How it works */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-white mb-4">How it works</h2>
          <div className="space-y-4">
            {[
              { step: "1", title: "Upload", desc: "Your document is stored securely and linked to your account only" },
              { step: "2", title: "Process", desc: "The AI chunks the text into segments and generates vector embeddings" },
              { step: "3", title: "Search", desc: "When you ask a question, the AI retrieves the most relevant sections" },
              { step: "4", title: "Answer", desc: "The Evidence Agent uses your document as a cited source in its response" },
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