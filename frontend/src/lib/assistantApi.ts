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
    const { data } = await this.client.post<AssistantChatResponse>('/api/assistant/chat', payload, { timeout: 25000 });
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
}

export const assistantApi = new AssistantApiClient(api);
