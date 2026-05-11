/**
 * Streaming API client for SmartMall AI OS.
 * Connects to /api/assistant/stream (SSE over fetch) with automatic
 * fallback to regular /api/assistant/chat if streaming is unavailable.
 */

import { API_BASE_URL, api } from './api';
import type { AssistantChatResponse } from './assistantApi';

export type StreamChunk =
  | { token: string; provider: string; done?: false }
  | { done: true; conversation_id: string; provider: string; memory_entries: number; error?: string };

export type StreamChatPayload = {
  message: string;
  conversation_id?: string | null;
  allow_automation?: boolean;
  lang?: string;
};

export type StreamCallbacks = {
  onToken: (token: string, provider: string) => void;
  onDone: (data: { conversation_id: string; provider: string; memory_entries: number }) => void;
  onError: (error: string) => void;
};

/**
 * Stream a chat response using SSE (Server-Sent Events via fetch).
 * Returns a cancel function — call it to abort the stream early.
 */
export function streamChat(
  payload: StreamChatPayload,
  callbacks: StreamCallbacks,
  token: string,
): () => void {
  const controller = new AbortController();
  const { onToken, onDone, onError } = callbacks;

  const baseUrl = API_BASE_URL;

  (async () => {
    try {
      const response = await fetch(`${baseUrl}/api/assistant/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        onError(`Server error ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('Streaming not supported by browser');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const chunk = JSON.parse(raw) as StreamChunk;

            if (chunk.done) {
              if ('error' in chunk && chunk.error) {
                onError(chunk.error);
              } else {
                onDone({
                  conversation_id: chunk.conversation_id,
                  provider: chunk.provider,
                  memory_entries: chunk.memory_entries,
                });
              }
              return;
            } else if ('token' in chunk) {
              onToken(chunk.token, chunk.provider);
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user cancelled
      onError((err as Error).message ?? 'Stream connection failed');
    }
  })();

  return () => controller.abort();
}

/**
 * Gracefully fall back to regular (non-streaming) chat.
 * Used when SSE is unavailable or the user's browser blocks it.
 */
export async function chatWithFallback(
  payload: StreamChatPayload,
): Promise<AssistantChatResponse> {
  const { data } = await api.post<AssistantChatResponse>('/api/assistant/chat', payload, {
    timeout: 30_000,
  });
  return data;
}
