/**
 * /retire — retired page; redirects to Ask Copilot.
 */
import { redirect } from "next/navigation";

// Retirement planning is now part of the unified Copilot chat
export default function RetirePage() {
  redirect("/chat");
}
