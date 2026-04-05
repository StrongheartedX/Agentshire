import type { ChannelPlugin } from "openclaw/plugin-sdk/core";
import { getTownRuntime } from "./runtime.js";
import { broadcastAgentEvent } from "./ws-server.js";
import { createOutboundAdapter } from "./outbound-adapter.js";
import { createTownSessionKey, sanitizeTownSessionId } from "./town-session.js";

const CHANNEL_ID = "agentshire";
const DEBUG = process.env.AGENTSHIRE_DEBUG === "1";

let _channelCtx: { rt: ReturnType<typeof getTownRuntime>; cfg: Record<string, unknown>; accountId: string } | null = null;

export async function sendNudgeMessage(townSessionId: string, body: string): Promise<void> {
  if (!_channelCtx) {
    console.warn('[agentshire] sendNudgeMessage: channel not started yet');
    return;
  }
  try {
    await dispatchTownMessage({ ..._channelCtx, townSessionId, body });
  } catch (err) {
    console.error('[agentshire] sendNudgeMessage error:', err);
  }
}

export interface ResolvedTownAccount {
  accountId: string;
  wsPort: number;
  townPort: number;
  autoLaunch: boolean;
}

function resolveAccount(
  cfg: Record<string, unknown>,
  accountId: string,
): ResolvedTownAccount {
  interface ChannelConfig {
    channels?: Record<string, { wsPort?: number; townPort?: number; autoLaunch?: boolean }>;
  }
  const channelCfg = (cfg as ChannelConfig)?.channels?.[CHANNEL_ID] ?? {};
  return {
    accountId,
    wsPort: channelCfg.wsPort ?? 55211,
    townPort: channelCfg.townPort ?? 55210,
    autoLaunch: channelCfg.autoLaunch ?? true,
  };
}

function waitUntilAbort(signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

async function dispatchTownMessage(params: {
  rt: ReturnType<typeof getTownRuntime>;
  cfg: Record<string, unknown>;
  accountId: string;
  townSessionId: string;
  body: string;
  mediaPaths?: string[];
}) {
  const { rt, cfg, accountId, townSessionId, body, mediaPaths } = params;
  const sessionKey = createTownSessionKey(accountId, townSessionId);

  const msgCtx = rt.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: body,
    CommandBody: body,
    From: `${CHANNEL_ID}:user`,
    To: `${CHANNEL_ID}:steward`,
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
      deliver: async (payload: any) => {
        const replyText = payload?.text ?? payload?.body;
        if (replyText) {
          broadcastAgentEvent({ type: "text", content: replyText }, townSessionId);
        }
      },
    },
  });
}

const { outbound: townOutbound, messaging: townMessaging } = createOutboundAdapter();

export const agentTownPlugin: ChannelPlugin<ResolvedTownAccount> = {
  id: CHANNEL_ID,

  meta: {
    id: CHANNEL_ID,
    label: "Agentshire",
    selectionLabel: "Agentshire (3D Visualization)",
    docsPath: "/channels/agentshire",
    docsLabel: "agentshire",
    blurb:
      "Visualize AI agents as NPCs in an interactive 3D low-poly town. " +
      "Watch them think, code, collaborate, and celebrate in real-time.",
    order: 100,
  },

  capabilities: {
    chatTypes: ["direct"],
    media: true,
    reactions: false,
    edit: false,
    unsend: false,
    reply: false,
    effects: true,
    threads: false,
  },

  reload: {
    configPrefixes: [`channels.${CHANNEL_ID}`],
  },

  config: {
    listAccountIds: () => ["default"],
    resolveAccount: (cfg: any, accountId: string) => resolveAccount(cfg, accountId),
    defaultAccountId: () => "default",
    isConfigured: () => true,
  },

  outbound: townOutbound,

  messaging: townMessaging,

  gateway: {
    startAccount: async (ctx: any) => {
      const account = ctx.account as ResolvedTownAccount;
      const rt = getTownRuntime();
      _channelCtx = { rt, cfg: ctx.cfg, accountId: account.accountId };
      const { startTownWsServer } = await import("./ws-server.js");
      const { CustomAssetManager } = await import("./custom-asset-manager.js");
      const { join } = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      const pluginDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
      const customAssetManager = new CustomAssetManager(pluginDir);

      const { LLMProxy } = await import("./llm-proxy.js");
      const llmProxy = new LLMProxy();

      startTownWsServer({
        port: account.wsPort,
        customAssetManager,
        onImplicitChat: async (payload) => {
          return llmProxy.chat({
            system: payload.system,
            user: payload.user,
            maxTokens: payload.maxTokens,
            temperature: payload.temperature,
            stop: payload.stop,
          });
        },
        onChat: async ({ message, townSessionId }) => {
          if (!message) return;
          console.log(
            `[agentshire] onChat received (${townSessionId}): len=${message.length}${DEBUG ? ` "${message.slice(0, 100)}"` : ""}`,
          );

          try {
            await dispatchTownMessage({
              rt,
              cfg: ctx.cfg,
              accountId: account.accountId,
              townSessionId: sanitizeTownSessionId(townSessionId),
              body: message,
            });
          } catch (err) {
            console.error("[agentshire] onChat dispatch error:", err);
          }
        },
        onMultimodal: async ({ parts, townSessionId, npcId }) => {
          console.log(
            `[agentshire] onMultimodal received (${townSessionId}): ${parts.length} parts${npcId ? ` npc=${npcId}` : ""}`,
          );
          try {
            const textParts = parts.filter((p: any) => p.kind === 'text').map((p: any) => p.text).join(' ');
            const mediaParts = parts.filter((p: any) => p.kind !== 'text' && typeof p.data === 'string');

            const mediaPaths: string[] = [];
            for (const part of mediaParts) {
              try {
                const buf = Buffer.from(part.data as string, 'base64');
                const saved = await rt.channel.media.saveMediaBuffer(
                  buf,
                  part.mimeType ?? 'application/octet-stream',
                  undefined,
                  undefined,
                  part.fileName,
                );
                mediaPaths.push(saved.path);
              } catch (err) {
                console.warn('[agentshire] Failed to save inbound media:', (err as Error).message);
              }
            }

            const body = textParts || (mediaPaths.length > 0 ? '[附件]' : '');
            if (!body && mediaPaths.length === 0) return;

            if (npcId) {
              const { routeCitizenMessage } = await import("./citizen-chat-router.js");
              await routeCitizenMessage({
                npcId,
                label: npcId,
                message: body,
                townSessionId: sanitizeTownSessionId(townSessionId),
                accountId: account.accountId,
                cfg: ctx.cfg,
                mediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
              });
            } else {
              await dispatchTownMessage({
                rt,
                cfg: ctx.cfg,
                accountId: account.accountId,
                townSessionId: sanitizeTownSessionId(townSessionId),
                body,
                mediaPaths: mediaPaths.length > 0 ? mediaPaths : undefined,
              });
            }
          } catch (err) {
            console.error("[agentshire] onMultimodal dispatch error:", err);
          }
        },
        onAction: async ({ action, townSessionId }) => {
          console.log(
            `[agentshire] onAction received (${townSessionId}): type=${action.type}`,
          );
          try {
            if (action.type === "user_message") {
              const text = String(action.text ?? "");
              if (!text) return;

              await dispatchTownMessage({
                rt,
                cfg: ctx.cfg,
                accountId: account.accountId,
                townSessionId: sanitizeTownSessionId(townSessionId),
                body: text,
              });
            } else if (action.type === "abort_requested") {
              rt.system.enqueueSystemEvent({ type: "abort" });
            }
          } catch (err) {
            console.error("[agentshire] onAction dispatch error:", err);
          }
        },
        onCitizenChat: async ({ npcId, message, townSessionId }) => {
          console.log(
            `[agentshire] onCitizenChat (${townSessionId}): npc=${npcId} len=${message.length}${DEBUG ? ` "${message.slice(0, 80)}"` : ""}`,
          );
          try {
            const { routeCitizenMessage } = await import("./citizen-chat-router.js");
            await routeCitizenMessage({
              npcId,
              label: npcId,
              message,
              townSessionId: sanitizeTownSessionId(townSessionId),
              accountId: account.accountId,
              cfg: ctx.cfg,
            });
          } catch (err) {
            console.error("[agentshire] onCitizenChat dispatch error:", err);
          }
        },
      });

      const townUrl = `http://localhost:${account.townPort}?ws=ws://localhost:${account.wsPort}`;
      console.log([
        "",
        "  ┌─────────────────────────────────────────────────────────────────┐",
        "  │  🏘️  Agentshire v2026.4.6 is live!                                │",
        "  │                                                                 │",
        `  │  Town:     http://localhost:${account.townPort}?ws=ws://localhost:${account.wsPort}  │`,
        `  │  Editor:   http://localhost:${account.townPort}/editor.html                          │`,
        `  │  Workshop: http://localhost:${account.townPort}/citizen-editor.html                   │`,
        "  │                                                                 │",
        "  │  💡 Chat in the browser to talk with your town steward          │",
        "  └─────────────────────────────────────────────────────────────────┘",
        "",
      ].join("\n"));

      if (account.autoLaunch) {
        try {
          const { exec } = await import("node:child_process");
          const cmd =
            process.platform === "darwin"
              ? `open "${townUrl}"`
              : process.platform === "win32"
                ? `start "${townUrl}"`
                : `xdg-open "${townUrl}"`;
          exec(cmd);
        } catch (err) {
          console.warn('[agentshire] Auto-launch browser failed:', (err as Error).message)
        }
      }

      await waitUntilAbort(ctx.abortSignal);

      const { stopTownWsServer } = await import("./ws-server.js");
      stopTownWsServer();
    },

    stopAccount: async () => {
      _channelCtx = null;
      const { stopTownWsServer } = await import("./ws-server.js");
      stopTownWsServer();
    },
  },

  agentPrompt: {
    formatHint: () =>
      "You are connected to a 3D Agentshire. Your actions are visualized as NPC behaviors " +
      "in a low-poly town. Users can see you thinking, coding, and collaborating. " +
      "Use the town_announce tool to broadcast messages, and town_effect to trigger visual effects.",
  },
};
