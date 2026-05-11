import type { AxiosInstance } from 'axios';

import { api } from './api';
import type { Lang } from '../i18n/cleanTranslations';

export type AssistantAction = {
  id: string;
  title: string;
  description: string;
  safe_to_run: boolean;
};

export type AssistantExecution = {
  action_id: string;
  title: string;
  summary: string;
  affected_records?: number | null;
  data: Record<string, unknown>;
  generated_at: string;
};

export type AssistantChatResponse = {
  conversation_id: string;
  provider: string;
  used_fallback: boolean;
  answer: string;
  analysis: string[];
  suggestions: string[];
  follow_up_questions: string[];
  suggested_actions: AssistantAction[];
  executed_actions: AssistantExecution[];
  memory_entries: number;
  generated_at: string;
};

export type AssistantStatus = {
  provider: string;
  model: string;
  llm_enabled: boolean;
  openai_enabled: boolean;
  gemini_enabled: boolean;
  fallback_active: boolean;
  provider_label?: string | null;
  router_health?: Record<string, unknown> | null;
};

export type AssistantMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  payload: Record<string, unknown>;
};

export type AssistantConversation = {
  id: string;
  title: string;
  messages: AssistantMessage[];
};

export type AssistantModule = {
  module: string;
  score: number;
  summary: string;
  issue?: string | null;
};

export type AssistantSystemAnalysis = {
  provider: string;
  used_fallback: boolean;
  executive_summary: string;
  key_metrics: Record<string, number | string | boolean>;
  modules: AssistantModule[];
  improvement_opportunities: string[];
  suggested_actions: AssistantAction[];
  generated_at: string;
};

export type ProviderHealth = {
  active_provider: string;
  openai: { provider: string; model: string; available: boolean; healthy: boolean; consecutive_failures: number; circuit_open: boolean };
  gemini: { provider: string; model: string; available: boolean; healthy: boolean; consecutive_failures: number; circuit_open: boolean };
  failover_count: number;
  last_failover: number | null;
  llm_available: boolean;
};

export type HealthCheckResult = {
  system_healthy: boolean;
  providers: Record<string, { ok: boolean; status_code?: number; latency_ms?: number; model?: string; error?: string }>;
  recommendation: string;
};

export class AssistantApiClient {
  private readonly client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  async getStatus() {
    const { data } = await this.client.get<AssistantStatus>('/api/assistant/status');
    return data;
  }

  async chat(payload: { message: string; conversation_id?: string | null; allow_automation: boolean; lang: Lang }) {
    const { data } = await this.client.post<AssistantChatResponse>('/api/assistant/chat', payload, { timeout: 35000 });
    return data;
  }

  async getConversation(conversationId: string) {
    const { data } = await this.client.get<AssistantConversation>(`/api/assistant/conversations/${conversationId}`);
    return data;
  }

  async getSystemAnalysis(lang: Lang) {
    const { data } = await this.client.get<AssistantSystemAnalysis>('/api/assistant/system-analysis', {
      params: { lang },
      timeout: 25000,
    });
    return data;
  }

  async executeAction(actionId: string, lang: Lang) {
    const { data } = await this.client.post<AssistantExecution>(`/api/assistant/actions/${actionId}`, null, {
      params: { lang },
    });
    return data;
  }

  /** SSE streaming chat — yields tokens as they arrive from the backend. */
  async streamChat(
    payload: { message: string; conversation_id?: string | null; lang: Lang },
    onToken: (token: string, provider: string) => void,
    onDone: (meta: { conversation_id: string; provider: string; memory_entries: number }) => void,
    onError?: (error: string) => void,
  ): Promise<void> {
    const token = localStorage.getItem('smartmall_user')
      ? JSON.parse(localStorage.getItem('smartmall_user')!).token
      : '';
    const baseURL = this.client.defaults.baseURL || '';

    const response = await fetch(`${baseURL}/api/assistant/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: payload.message,
        conversation_id: payload.conversation_id,
        allow_automation: true,
        lang: payload.lang,
      }),
    });

    if (!response.ok || !response.body) {
      onError?.(`Stream request failed: ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.error) {
            onError?.(parsed.error);
            return;
          }
          if (parsed.done) {
            onDone({
              conversation_id: parsed.conversation_id,
              provider: parsed.provider,
              memory_entries: parsed.memory_entries,
            });
            return;
          }
          if (parsed.token) {
            onToken(parsed.token, parsed.provider || 'unknown');
          }
        } catch {
          // Incomplete JSON chunk, skip
        }
      }
    }
  }

  /** Get real-time provider health (circuit breaker status, failover count). */
  async getProviderStatus() {
    const { data } = await this.client.get<ProviderHealth>('/api/assistant/provider-status');
    return data;
  }

  /** Live connectivity test — pings both AI providers and returns latency. */
  async healthCheck() {
    const { data } = await this.client.get<HealthCheckResult>('/api/assistant/health-check', { timeout: 20000 });
    return data;
  }
}

export const assistantApi = new AssistantApiClient(api);
