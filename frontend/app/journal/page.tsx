import { redirect } from "next/navigation";

// The Journal page was removed. Decisions are still recorded by the backend
// (GET /decisions/journal) as an audit trail.
export default function JournalPage() {
  redirect("/chat");
}
