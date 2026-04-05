/**
 * Routes user messages to independent citizen agents.
 * Reads agentId from citizen-config.json (published) and dispatches
 * to the citizen's own session via SessionKey = "agent:{agentId}:{townSessionId}".
 */

import { getTownRuntime } from "./runtime.js";
import { pushCitizenMessages } from "./ws-server.js";
import { sanitizeTownSessionId } from "./town-session.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHANNEL_ID = "agentshire";

function getPublishedConfigPath(): string {
  const pluginDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
  return join(pluginDir, "town-data", "citizen-config.json");
}

function findCitizenAgentId(npcId: string): string | null {
  try {
    const configPath = getPublishedConfigPath();
    if (!existsSync(configPath)) return null;
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const characters: any[] = config.characters ?? [];
    const citizen = characters.find((c: any) => c.id === npcId && c.role === "citizen");
    if (!citizen?.agentEnabled || !citizen?.agentId) return null;
    return citizen.agentId;
  } catch {
    return null;
  }
}

export async function routeCitizenMessage(params: {
  npcId: string;
  label: string;
  message: string;
  townSessionId: string;
  accountId: string;
  cfg: Record<string, unknown>;
  mediaPaths?: string[];
}): Promise<void> {
  const { npcId, label, message, townSessionId, accountId, cfg, mediaPaths } = params;

  const agentId = findCitizenAgentId(npcId);
  if (!agentId) {
    console.log(`[citizen-chat] No active agent for ${label} (${npcId}), message dropped`);
    return;
  }

  const rt = getTownRuntime();
  const sanitizedSession = sanitizeTownSessionId(townSessionId);
  const sessionKey = `agent:${agentId}:${sanitizedSession}`;

  console.log(`[citizen-chat] Routing to ${agentId} (${label}), sessionKey=${sessionKey}`);

  const msgCtx = rt.channel.reply.finalizeInboundContext({
    Body: message,
    RawBody: message,
    CommandBody: message,
    From: `${CHANNEL_ID}:user`,
    To: `${CHANNEL_ID}:${npcId}`,
    SessionKey: sessionKey,
    AccountId: accountId,
    OriginatingChannel: CHANNEL_ID,
    ChatType: "direct",
    SenderId: "user",
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    ...(mediaPaths?.length ? { MediaPaths: mediaPaths } : {}),
  });

  await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: msgCtx,
    cfg,
    dispatcherOptions: {
      deliver: async (_payload: any) => {
        setTimeout(() => pushCitizenMessages(agentId, townSessionId), 500);
      },
    },
  });
}
