/**
 * useChat: the Ask Copilot conversation — messages, sending a question, and
 * starting a new chat. Messages are kept for the browser session, so the chat
 * survives switching pages.
 */
import { askCopilot, getErrorMessage } from "./api";
import { answerToText, toHistory, type CopilotAnswer } from "./chatSession";
import { useSessionState } from "./sessionStore";

/** One message in the conversation. */
export interface ChatMessage {
  role: "user" | "assistant";
  /** Plain text (user questions, clarifying questions, errors). */
  content: string;
  /** Structured answer, rendered as a card instead of `content`. */
  answer?: CopilotAnswer;
  /** Placeholder while the answer is being generated. */
  pending?: boolean;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hello! I am your Wealth Intelligence Copilot. Ask me anything about a stock, your whole portfolio, or your retirement plans — just type naturally.",
  },
];

// How many earlier turns are sent with each question for context
const HISTORY_TURNS = 12;

// A request keeps running when you switch screens (the chat is stored outside
// the page), so "is a question in flight?" lives at module level: it survives
// client-side navigation but resets on a full reload, when the request is lost.
let requestInFlight = false;

/** Conversation state: { messages, ask, reset, loading, interrupted }. */
export function useChat() {
  const [messages, setMessages, reset] = useSessionState<ChatMessage[]>("chat_messages", INITIAL_MESSAGES);

  const hasPending = messages.some((m) => m.pending);
  const loading = hasPending && requestInFlight;
  // A pending answer with no request behind it means the page was reloaded mid-answer
  const interrupted = hasPending && !requestInFlight;

  const ask = async (question: string) => {
    const query = question.trim();
    if (!query || loading) return;

    // Structured answers are converted to text so the backend keeps the context
    // (e.g. which stock "it" refers to, or the age/income already given)
    const history = toHistory(
      messages.slice(1).filter((m) => !m.pending).map((m) => ({
        role: m.role,
        content: m.answer ? answerToText(m.answer) : m.content,
      })),
      HISTORY_TURNS
    );

    requestInFlight = true;
    setMessages((prev) => [
      ...prev.filter((m) => !m.pending),
      { role: "user", content: query },
      { role: "assistant", content: "", pending: true },
    ]);

    try {
      const data = await askCopilot(query, history);
      const reply: ChatMessage =
        data.route === "clarify"
          ? { role: "assistant", content: data.message }
          : { role: "assistant", content: "", answer: data };
      setMessages((prev) => [...prev.filter((m) => !m.pending), reply]);
    } catch (err) {
      setMessages((prev) => [...prev.filter((m) => !m.pending), { role: "assistant", content: getErrorMessage(err) }]);
    } finally {
      requestInFlight = false;
    }
  };

  return { messages, ask, reset, loading, interrupted };
}
