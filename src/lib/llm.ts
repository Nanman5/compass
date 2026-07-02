/**
 * Compass — provider-agnostic LLM client.
 *
 * Wraps Gemini (Google Generative AI) and OpenAI behind the single `LlmClient`
 * contract from "@/lib/types", with native function/tool-calling on both sides.
 *
 * The Coach agent drives the tool loop: ONE `generate()` call === one model turn.
 * This module faithfully translates our provider-agnostic ChatMessage[] / ToolDef[]
 * into each provider's wire format and parses tool calls back into our ToolCall[].
 *
 * Provider selection (see `getLlm`): pick from env LLM_PROVIDER, else try Gemini,
 * health-check it, and fall back to OpenAI if Gemini fails to authenticate. The
 * resolved client is cached with a short TTL so a transient failure at first
 * resolution can't pin the process to the wrong provider.
 *
 * Server-only: reads secrets from process.env; never expose keys to the client.
 */
import "server-only";

import {
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type ModelParams,
} from "@google/generative-ai";
import OpenAI from "openai";

import type {
  ChatMessage,
  LlmClient,
  LlmGenerateOptions,
  LlmResponse,
  ToolCall,
  ToolDef,
} from "@/lib/types";

/* ─────────────────────────────── config & helpers */

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** Per-request wall-clock budget. The Coach turn target is ~30s; one model turn must fit well under that. */
const REQUEST_TIMEOUT_MS = 25_000;
/** Tiny budget for the auth health-check ping in `getLlm`. */
const HEALTHCHECK_TIMEOUT_MS = 8_000;

/** Wrap any provider error with module context so callers never see a raw SDK error. */
class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmError";
  }
}

/** Reject if `promise` does not settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LlmError(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Run `fn`, and on a transient failure retry exactly once. Auth/4xx-style errors
 * are not retried (a second identical call would fail the same way).
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isTransient(err)) throw err;
    return await fn().catch((retryErr) => {
      throw new LlmError(`${label} failed after one retry`, { cause: retryErr });
    });
  }
}

/** Heuristic: timeouts, network blips, and 5xx / 429 are worth one retry; auth/4xx are not. */
function isTransient(err: unknown): boolean {
  if (err instanceof LlmError && err.message.includes("timed out")) return true;
  const status = readStatus(err);
  if (status !== undefined) return status === 429 || status >= 500;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("econn") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("socket")
  );
}

/** Best-effort HTTP status extraction across SDK error shapes. */
function readStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as { status?: unknown; code?: unknown };
    if (typeof e.status === "number") return e.status;
    if (typeof e.code === "number") return e.code;
  }
  return undefined;
}

/** Does an error look like an authentication / invalid-key failure (→ trigger fallback)? */
function isAuthError(err: unknown): boolean {
  const status = readStatus(err);
  if (status === 401 || status === 403) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("api key") ||
    msg.includes("api_key") ||
    msg.includes("apikey") ||
    msg.includes("unauthenticated") ||
    msg.includes("unauthorized") ||
    msg.includes("permission denied") ||
    msg.includes("invalid argument") ||
    msg.includes("400")
  );
}

/* ─────────────────────────────── Gemini provider */

/**
 * Gemini's content roles are "user" | "model" only, and tool results are sent as
 * `functionResponse` parts. We collapse our richer ChatMessage[] into that shape.
 */
class GeminiClient implements LlmClient {
  readonly provider = "gemini" as const;
  readonly model: string;
  private readonly sdk: GoogleGenerativeAI;

  constructor(apiKey: string, model: string) {
    this.sdk = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async generate(opts: LlmGenerateOptions): Promise<LlmResponse> {
    const tools = mapToolsToGemini(opts.tools);
    const params: ModelParams = {
      model: opts.model || this.model,
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
      generationConfig: {
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    };
    const model = this.sdk.getGenerativeModel(params);

    const contents = mapMessagesToGemini(opts.messages);

    const result = await withRetry(
      () => withTimeout(model.generateContent({ contents }), REQUEST_TIMEOUT_MS, "gemini.generate"),
      "gemini.generate",
    ).catch((err) => {
      throw new LlmError(`Gemini generateContent failed (model=${this.model})`, { cause: err });
    });

    return parseGeminiResponse(result.response);
  }
}

/** Map our ToolDef[] to Gemini functionDeclarations (undefined when no tools). */
function mapToolsToGemini(tools?: ToolDef[]): FunctionDeclaration[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  // `parameters` is our provider-agnostic JSON Schema. Gemini's function-declaration schema
  // is a strict subset of JSON Schema and REJECTS `additionalProperties` (and `$schema`) —
  // it 400s the whole call. Strip those keys recursively at the SDK boundary.
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: stripUnsupportedSchemaKeys(t.parameters) as unknown as FunctionDeclaration["parameters"],
  }));
}

/** Deep-clone a JSON Schema, dropping keys Gemini's tool schema doesn't accept. */
function stripUnsupportedSchemaKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnsupportedSchemaKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "additionalProperties" || k === "$schema") continue;
      out[k] = stripUnsupportedSchemaKeys(v);
    }
    return out;
  }
  return value;
}

/** Collapse our ChatMessage[] into Gemini `contents` (user/model + functionResponse parts). */
function mapMessagesToGemini(messages: ChatMessage[]): Content[] {
  // System messages are handled via systemInstruction; any stray ones are folded into user text.
  const contents: Content[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      // The model turn that requested tools must replay its functionCall parts, so the
      // following functionResponse parts have something to answer.
      const parts: Content["parts"] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) {
        parts.push({
          functionCall: { name: c.name, args: c.arguments },
          // Replay the thought signature — Gemini 3.x 400s a functionCall in history without it.
          ...(c.thoughtSignature ? { thoughtSignature: c.thoughtSignature } : {}),
        } as Content["parts"][number]);
      }
      if (parts.length === 0) parts.push({ text: "" });
      contents.push({ role: "model", parts });
    } else {
      // role === "tool": a function result. Gemini expects role "user" with a functionResponse part.
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.name ?? m.toolCallId ?? "tool",
              response: safeJsonObject(m.content),
            },
          },
        ],
      });
    }
  }
  return contents;
}

/** Parse Gemini's response into our { text, toolCalls } shape. */
function parseGeminiResponse(response: unknown): LlmResponse {
  const res = response as {
    text?: () => string;
    candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
  };

  const parts = res.candidates?.[0]?.content?.parts ?? [];
  const toolCalls: ToolCall[] = [];
  const textChunks: string[] = [];
  let fnIndex = 0;

  for (const part of parts) {
    const fn = part["functionCall"] as { name?: string; args?: unknown } | undefined;
    if (fn?.name) {
      const sig = part["thoughtSignature"];
      toolCalls.push({
        id: `gemini-call-${fnIndex++}-${fn.name}`,
        name: fn.name,
        arguments: asArgs(fn.args),
        // Gemini 3.x requires this signature back on the replayed functionCall part.
        ...(typeof sig === "string" ? { thoughtSignature: sig } : {}),
      });
    }
    const text = part["text"];
    if (typeof text === "string") textChunks.push(text);
  }

  // Prefer concatenated parts; fall back to the SDK's text() helper.
  let text = textChunks.join("");
  if (!text) {
    try {
      text = res.text?.() ?? "";
    } catch {
      text = "";
    }
  }

  return { text, toolCalls };
}

/* ─────────────────────────────── OpenAI provider */

class OpenAIClient implements LlmClient {
  readonly provider = "openai" as const;
  readonly model: string;
  private readonly sdk: OpenAI;

  constructor(apiKey: string, model: string) {
    this.sdk = new OpenAI({ apiKey });
    this.model = model;
  }

  async generate(opts: LlmGenerateOptions): Promise<LlmResponse> {
    const messages = mapMessagesToOpenAI(opts.system, opts.messages);
    const tools = mapToolsToOpenAI(opts.tools);

    const result = await withRetry(
      () =>
        withTimeout(
          this.sdk.chat.completions.create(
            {
              model: opts.model || this.model,
              messages,
              ...(tools ? { tools } : {}),
              ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
              ...(opts.json ? { response_format: { type: "json_object" } } : {}),
            },
            { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
          ),
          REQUEST_TIMEOUT_MS,
          "openai.generate",
        ),
      "openai.generate",
    ).catch((err) => {
      throw new LlmError(`OpenAI chat.completions failed (model=${this.model})`, { cause: err });
    });

    return parseOpenAIResponse(result);
  }
}

/** Map our ToolDef[] to OpenAI tools (type:"function"); undefined when no tools. */
function mapToolsToOpenAI(
  tools?: ToolDef[],
): OpenAI.Chat.Completions.ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** Translate system + ChatMessage[] into OpenAI chat messages (incl. role:"tool"). */
function mapMessagesToOpenAI(
  system: string | undefined,
  messages: ChatMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (system) out.push({ role: "system", content: system });

  for (const m of messages) {
    if (m.role === "tool") {
      // OpenAI requires tool_call_id to correlate the result with the prior call.
      out.push({
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId ?? m.name ?? "tool",
      });
    } else if (m.role === "system") {
      out.push({ role: "system", content: m.content });
    } else if (m.role === "assistant") {
      // Include the turn's tool calls — OpenAI 400s a role:"tool" message whose preceding
      // assistant message doesn't carry the matching tool_calls ids.
      const toolCalls = (m.toolCalls ?? []).map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: JSON.stringify(c.arguments) },
      }));
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    } else {
      out.push({ role: "user", content: m.content });
    }
  }
  return out;
}

/** Parse OpenAI's completion into our { text, toolCalls } shape. */
function parseOpenAIResponse(completion: OpenAI.Chat.Completions.ChatCompletion): LlmResponse {
  const choice = completion.choices[0];
  const message = choice?.message;
  const text = message?.content ?? "";

  const toolCalls: ToolCall[] = [];
  for (const call of message?.tool_calls ?? []) {
    if (call.type !== "function") continue;
    toolCalls.push({
      id: call.id,
      name: call.function.name,
      arguments: asArgs(safeJsonParse(call.function.arguments)),
    });
  }

  return { text, toolCalls };
}

/* ─────────────────────────────── shared parsing helpers */

/** Coerce arbitrary tool arguments into a plain Record (never throws). */
function asArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Parse a JSON string defensively; return undefined on failure. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A tool result must be an object for Gemini's functionResponse; wrap raw strings. */
function safeJsonObject(text: string): Record<string, unknown> {
  const parsed = safeJsonParse(text);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return { result: text };
}

/* ─────────────────────────────── factory + health check */

/**
 * The resolved client is cached with a TTL rather than for the process lifetime: if Gemini
 * happened to be down (or mis-picked) at first resolution, we'd otherwise be pinned to the
 * fallback until a restart. Re-resolving every few minutes self-heals at one health-check
 * of cost, and concurrent callers share one in-flight resolution.
 */
const CACHE_TTL_MS = 5 * 60_000;
let cached: LlmClient | null = null;
let cachedAt = 0;
let resolving: Promise<LlmClient> | null = null;

/** Build the Gemini client from env, or null if no key is configured. */
function buildGemini(): GeminiClient | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GeminiClient(key, process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
}

/** Build the OpenAI client from env, or null if no key is configured. */
function buildOpenAI(): OpenAIClient | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAIClient(key, process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL);
}

/**
 * Cheap 1-token "ping" to confirm the provider's credentials actually work.
 * Resolves true on success; false on auth/invalid-key failure. Transient errors
 * (timeouts/5xx) are treated as "healthy enough" — we don't want a network blip
 * during the health check to bounce a valid provider to the fallback.
 */
async function healthCheck(client: LlmClient): Promise<boolean> {
  try {
    await withTimeout(
      client.generate({ messages: [{ role: "user", content: "ping" }] }),
      HEALTHCHECK_TIMEOUT_MS,
      `${client.provider}.healthcheck`,
    );
    return true;
  } catch (err) {
    if (isAuthError(err)) return false;
    // Non-auth failure: assume the key is fine, the provider just hiccuped.
    console.warn(
      `[llm] health check for ${client.provider} hit a non-auth error; assuming credentials are valid.`,
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}

/**
 * Resolve the active LlmClient.
 *
 * Order: env LLM_PROVIDER if set, else Gemini first. The chosen provider is
 * health-checked; if Gemini fails to authenticate (its key may be a
 * non-standard/invalid format), we automatically fall back to OpenAI. The
 * resolved client is cached for the process.
 */
export async function getLlm(): Promise<LlmClient> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  if (resolving) return resolving;
  resolving = resolveLlm()
    .then((client) => {
      cached = client;
      cachedAt = Date.now();
      return client;
    })
    .finally(() => {
      resolving = null;
    });
  return resolving;
}

async function resolveLlm(): Promise<LlmClient> {
  const preference = (process.env.LLM_PROVIDER || "").toLowerCase();
  const gemini = buildGemini();
  const openai = buildOpenAI();

  // Forced provider via env — honor it, but still verify and fall back if it can't auth.
  if (preference === "openai") {
    if (openai && (await healthCheck(openai))) {
      console.warn("[llm] selected provider: openai (LLM_PROVIDER=openai)");
      return openai;
    }
    if (gemini && (await healthCheck(gemini))) {
      console.warn("[llm] LLM_PROVIDER=openai failed health check; fell back to gemini");
      return gemini;
    }
    throw new LlmError("No working LLM provider: openai requested but neither provider authenticated");
  }

  // Default path (and LLM_PROVIDER=gemini): try Gemini first, fall back to OpenAI.
  if (gemini && (await healthCheck(gemini))) {
    console.warn(`[llm] selected provider: gemini (model=${gemini.model})`);
    return gemini;
  }

  if (gemini) {
    console.warn("[llm] gemini failed to authenticate; falling back to openai");
  } else {
    console.warn("[llm] no GEMINI_API_KEY configured; using openai");
  }

  if (openai && (await healthCheck(openai))) {
    console.warn(`[llm] selected provider: openai (model=${openai.model})`);
    return openai;
  }

  throw new LlmError(
    "No working LLM provider: set a valid GEMINI_API_KEY or OPENAI_API_KEY in the environment",
  );
}

/** Test seam: drop the cached client (e.g. after changing env in a test). */
export function resetLlmCache(): void {
  cached = null;
  cachedAt = 0;
  resolving = null;
}
