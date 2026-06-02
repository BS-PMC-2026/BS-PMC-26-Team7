/**
 * Types for the visitor AI chatbot.
 */

/** A single message in the chat conversation, used by the UI. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The backend reply from POST /api/chatbot.
 * `source` indicates where the answer came from:
 *   - "db"       → grounded in internal data from the database
 *   - "ai"       → a general recommendation from OpenAI
 *   - "fallback" → no matching data / service unavailable
 */
export interface ChatResponse {
  answer: string;
  source: "db" | "ai" | "fallback";
}
