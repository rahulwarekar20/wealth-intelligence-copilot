/**
 * The user's uploaded documents, each with size, upload date and a delete button.
 */
import type { StoredDocument } from "@/lib/types";
import { IconDocument } from "../ui/Icons";

export default function DocumentList({
  documents,
  onDelete,
}: {
  documents: StoredDocument[];
  onDelete: (doc: StoredDocument) => void;
}) {
  return (
    <div className="card p-7">
      <h2 className="mb-4 font-display text-2xl font-medium text-ink-900">Your documents</h2>
      {documents.length === 0 ? (
        <p className="text-sm text-ink-500">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="card-inset flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <IconDocument className="shrink-0 text-gold-500" />
                <div>
                  <p className="text-sm font-semibold text-ink-900">{doc.filename}</p>
                  <p className="text-xs text-ink-600">
                    {doc.size_kb} KB · uploaded {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button onClick={() => onDelete(doc)} className="text-sm text-ink-500 transition hover:text-brick-500">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
