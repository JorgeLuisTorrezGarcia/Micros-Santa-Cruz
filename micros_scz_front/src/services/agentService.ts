import { AgentChatMessage, AgentFunctionCall } from '../types.ts';
import { apiRequest } from './apiClient.ts';

export interface AgentChatResponse {
  reply: string;
  functionCalls: AgentFunctionCall[];
  error?: string;
}

/**
 * Sends a message with conversation history to the decoupled backend Gemini agent.
 */
export async function sendAgentMessage(
  message: string,
  history: AgentChatMessage[]
): Promise<AgentChatResponse> {
  const formattedHistory = history.map((item) => ({
    role: item.role,
    content: item.content,
  }));

  return apiRequest<AgentChatResponse>('/api/agent/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: formattedHistory,
    }),
  });
}

/**
 * Reads text aloud using browser SpeechSynthesis API.
 */
export function speakText(text: string, onEnd?: () => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return () => {};
  }

  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/[*_#`~[\]]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();

  if (!cleanText) return () => {};

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'es-BO';
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const spanishVoice =
    voices.find((v) => v.lang.startsWith('es-BO')) ||
    voices.find((v) => v.lang.startsWith('es')) ||
    null;

  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

/**
 * Stop any active speech synthesis.
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
