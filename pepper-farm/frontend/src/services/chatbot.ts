import { apiFetch } from "./apiClient";
import { ChatResponse } from "@/types/chatbot";

/**
 * Send a visitor question to the chatbot.
 *
 * Public endpoint — no auth required. `apiFetch` still injects a token if one
 * happens to be present, which is harmless.
 */
export async function sendChatMessage(message: string): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/chatbot", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
