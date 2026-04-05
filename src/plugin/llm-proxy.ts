/**
 * Lightweight LLM proxy for implicit NPC behaviors (daily plans, encounters, reflections).
 * Reads provider config from openclaw.json and makes direct HTTP calls,
 * bypassing the full OpenClaw agent system for speed and cost efficiency.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface LLMProxyConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  apiFormat: "anthropic-messages" | "openai";
}

export interface LLMChatRequest {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  stop: string[];
}

export interface LLMChatResult {
  text: string;
  usage?: { input: number; output: number };
}

function getOpenClawConfigPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
  return join(home, ".openclaw", "openclaw.json");
}

function resolveEnvVar(value: string, env: Record<string, string>): string {
  return value.replace(/\$\{(\w+)\}/g, (_, key) => env[key] ?? process.env[key] ?? "");
}

function loadProviderFromConfig(): LLMProxyConfig | null {
  try {
    const cfgPath = getOpenClawConfigPath();
    if (!existsSync(cfgPath)) return null;
    const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
    const env: Record<string, string> = cfg.env ?? {};
    const providers = cfg.models?.providers;
    if (!providers || typeof providers !== "object") return null;

    for (const [, provider] of Object.entries(providers) as [string, any][]) {
      if (!provider.baseUrl || !provider.apiKey) continue;
      const apiKey = resolveEnvVar(String(provider.apiKey), env);
      if (!apiKey) continue;

      const apiFormat = provider.api === "openai" ? "openai" as const : "anthropic-messages" as const;
      const models = Array.isArray(provider.models) ? provider.models : [];
      const model = models[0]?.id ?? "default";

      return {
        baseUrl: String(provider.baseUrl).replace(/\/+$/, ""),
        apiKey,
        model,
        apiFormat,
      };
    }
  } catch (err) {
    console.warn("[llm-proxy] Failed to load provider from openclaw.json:", (err as Error).message);
  }
  return null;
}

async function callAnthropicMessages(
  config: LLMProxyConfig,
  req: LLMChatRequest,
): Promise<LLMChatResult> {
  const body = {
    model: config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
    ...(req.stop.length > 0 ? { stop_sequences: req.stop } : {}),
  };

  const url = `${config.baseUrl}/v1/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Anthropic API ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content?.find(b => b.type === "text")?.text ?? "";
  return {
    text,
    usage: data.usage
      ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 }
      : undefined,
  };
}

async function callOpenAI(
  config: LLMProxyConfig,
  req: LLMChatRequest,
): Promise<LLMChatResult> {
  const body = {
    model: config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    ...(req.stop.length > 0 ? { stop: req.stop } : {}),
  };

  const url = `${config.baseUrl}/v1/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenAI API ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text,
    usage: data.usage
      ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 }
      : undefined,
  };
}

export class LLMProxy {
  private config: LLMProxyConfig | null = null;
  private enabled = true;
  private activeRequests = 0;
  private readonly maxConcurrent = 2;
  private readonly requestQueue: Array<{
    req: LLMChatRequest;
    resolve: (r: LLMChatResult) => void;
    reject: (e: Error) => void;
  }> = [];

  constructor(explicitConfig?: LLMProxyConfig) {
    this.config = explicitConfig ?? loadProviderFromConfig();
    if (this.config) {
      const safeUrl = process.env.AGENTSHIRE_DEBUG === "1" ? this.config.baseUrl : this.config.baseUrl.replace(/\/\/.*@/, "//***@");
      console.log(`[llm-proxy] Initialized: ${this.config.apiFormat} / ${this.config.model} @ ${safeUrl}`);
    } else {
      console.warn("[llm-proxy] No provider found — implicit chat will use fallback responses");
    }
  }

  isAvailable(): boolean {
    return this.enabled && this.config !== null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  async chat(req: LLMChatRequest): Promise<LLMChatResult> {
    if (!this.config || !this.enabled) {
      return { text: "" };
    }

    if (this.activeRequests >= this.maxConcurrent) {
      return new Promise<LLMChatResult>((resolve, reject) => {
        if (this.requestQueue.length >= 10) {
          resolve({ text: "" });
          return;
        }
        this.requestQueue.push({ req, resolve, reject });
      });
    }

    return this.executeChat(req);
  }

  private async executeChat(req: LLMChatRequest): Promise<LLMChatResult> {
    this.activeRequests++;
    try {
      const result = this.config!.apiFormat === "openai"
        ? await callOpenAI(this.config!, req)
        : await callAnthropicMessages(this.config!, req);
      return result;
    } finally {
      this.activeRequests--;
      this.drainQueue();
    }
  }

  private drainQueue(): void {
    if (this.requestQueue.length === 0 || this.activeRequests >= this.maxConcurrent) return;
    const next = this.requestQueue.shift()!;
    this.executeChat(next.req).then(next.resolve, next.reject);
  }
}
