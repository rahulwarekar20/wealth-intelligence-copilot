/**
 * useChat: the Ask Copilot conversation — messages, sending a question,
 * retrying a failed one, and starting a new chat. Messages are kept for the
 * browser session, so the chat survives switching pages.
 */
import axios from "axios";
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
  /** On a failed or interrupted answer: the question, so it can be asked again. */
  retry?: string;
}

// Shown when the request never reached the server or the connection dropped mid-answer
const CONNECTION_LOST =
  "The connection to the server was lost before the answer arrived. Check your connection and try again.";

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

  /**
   * Sends a question. With `isRetry`, the failed attempt (the question and its
   * error, or an interrupted placeholder) is replaced instead of repeated.
   */
  const ask = async (question: string, isRetry = false) => {
    const query = question.trim();
    if (!query || loading) return;

    // Drop the failed attempt being retried: its error reply and its question
    const dropFailed = (list: ChatMessage[]) => {
      if (!isRetry) return list;
      const trimmed = [...list];
      if (trimmed.length && (trimmed[trimmed.length - 1].retry || trimmed[trimmed.length - 1].pending)) trimmed.pop();
      if (trimmed.length && trimmed[trimmed.length - 1].role === "user") trimmed.pop();
      return trimmed;
    };

    // Structured answers are converted to text so the backend keeps the context
    // (e.g. which stock "it" refers to, or the age/income already given)
    const history = toHistory(
      dropFailed(messages).slice(1).filter((m) => !m.pending && !m.retry).map((m) => ({
        role: m.role,
        content: m.answer ? answerToText(m.answer) : m.content,
      })),
      HISTORY_TURNS
    );

    requestInFlight = true;
    setMessages((prev) => [
      ...dropFailed(prev).filter((m) => !m.pending),
      { role: "user", content: query },
      // `retry` survives a page reload, so an interrupted question can be asked again
      { role: "assistant", content: "", pending: true, retry: query },
    ]);

    try {
      const data = await askCopilot(query, history);
      const reply: ChatMessage =
        data.route === "clarify"
          ? { role: "assistant", content: data.message }
          : { role: "assistant", content: "", answer: data };
      setMessages((prev) => [...prev.filter((m) => !m.pending), reply]);
    } catch (err) {
      const content = axios.isAxiosError(err) && !err.response ? CONNECTION_LOST : getErrorMessage(err);
      setMessages((prev) => [...prev.filter((m) => !m.pending), { role: "assistant", content, retry: query }]);
    } finally {
      requestInFlight = false;
    }
  };

  return { messages, ask, reset, loading, interrupted };
}
