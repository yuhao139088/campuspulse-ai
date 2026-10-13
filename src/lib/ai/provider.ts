type Message = { role: string; content?: unknown; tool_calls?: unknown; tool_call_id?: string };
import { aiConfig } from "../system-config";

export async function callAI(messages: Message[], options: { json?: boolean; tools?: unknown[]; timeout?: number } = {}) {
  const config = await aiConfig();
  if (!config.enabled) throw new Error("AI is disabled by the system administrator");
  const key = config.apiKey;
  if (!key) throw new Error("CARBON_AI_API_KEY is not configured");
  const url = config.baseUrl.replace(/\/$/, "");
  if (!url) throw new Error("CARBON_AI_BASE_URL is not configured");
  const response = await fetch(url + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model: messages.some((message) => Array.isArray(message.content)) ? config.visionModel : config.model, temperature: 0.15, messages, ...(options.json ? { response_format: { type: "json_object" } } : {}), ...(options.tools ? { tools: options.tools, tool_choice: "auto" } : {}) }),
    signal: AbortSignal.timeout(options.timeout ?? config.timeout * 1000),
  });
  if (!response.ok) throw new Error("AI upstream HTTP " + response.status);
  const payload = await response.json();
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("Empty AI response");
  return { content: typeof message.content === "string" ? message.content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim() : "", tool_calls: message.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined };
}
