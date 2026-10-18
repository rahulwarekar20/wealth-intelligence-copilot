"use client";

/**
 * Documents ("/upload"): upload private research the AI can cite, and manage
 * what's stored. Sections live in components/documents/.
 */
import { useCallback, useEffect, useState } from "react";
import DocumentList from "../components/documents/DocumentList";
import DocumentSteps from "../components/documents/DocumentSteps";
import UploadPanel from "../components/documents/UploadPanel";
import PageHeader from "../components/layout/PageHeader";
import PageLayout, { PageContainer } from "../components/layout/PageLayout";
import Callout from "../components/ui/Callout";
import { deleteDocument, getErrorMessage, listDocuments } from "@/lib/api";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { StoredDocument } from "@/lib/types";

export default function UploadPage() {
  useRequireAuth();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [error, setError] = useState("");

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
      <PageContainer>
        <PageHeader
          eyebrow="Documents"
          title={<>Your private <span className="italic text-gold-500">research</span></>}
          description="Upload documents the AI can't find on its own, such as research reports or notes on a company. They are used as cited evidence when you ask about a company they mention."
        />

        {error && <Callout tone="error" className="mb-6">{error}</Callout>}

        <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Left: upload and stored documents */}
          <div className="space-y-6">
            <UploadPanel onUploaded={loadDocuments} />
            <DocumentList documents={documents} onDelete={handleDelete} />
          </div>

          {/* Right: what's fetched automatically, and how uploads are used */}
          <div className="space-y-6">
            <Callout tone="note">
              No need to upload public filings: 10-K and 10-Q reports for US-listed companies are fetched
              automatically from SEC EDGAR and cited in every stock analysis.
            </Callout>
            <DocumentSteps />
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
}
