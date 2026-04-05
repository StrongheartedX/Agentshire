import './styles.css'
import { Engine } from './engine'
import { MainScene } from './game/MainScene'
import { PlatformBridge } from './platform/Bridge'
import { MockDataSource } from './data/MockDataSource'
import { TownConfigStore } from './data/TownConfigStore'
import type { IWorldDataSource } from './data/IWorldDataSource'
import { InputBar, type TownMessage } from './ui/InputBar'

interface WsHistoryMessage {
  role?: 'user' | 'assistant'
  text?: string
  timestamp?: number
  type?: 'text' | 'image' | 'video' | 'audio' | 'file'
  fileName?: string
}

function summarizeHistoryMessage(msg: WsHistoryMessage): string {
  if (typeof msg.text === 'string' && msg.text.trim()) return msg.text.trim()
  switch (msg.type) {
    case 'image':
      return '[图片]'
    case 'video':
      return msg.fileName?.trim() || '[视频]'
    case 'audio':
      return msg.fileName?.trim() || '[音频]'
    case 'file':
      return msg.fileName?.trim() || '[文件]'
    default:
      return ''
  }
}

function createTownSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `town-${crypto.randomUUID()}`
  }
  return `town-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatTownSessionLabel(townSessionId: string): string {
  if (townSessionId.length <= 24) return townSessionId
  return `${townSessionId.slice(0, 12)}...${townSessionId.slice(-8)}`
}

async function main() {
  const params = new URLSearchParams(location.search)

  const container = document.getElementById('game-container')
  if (!container) throw new Error('game-container not found')

  const engine = new Engine(container)
  await engine.init()

  const configStore = new TownConfigStore()
  const initialTownSessionId =
    params.get('townSessionId') || configStore.getSessionId() || createTownSessionId()
  configStore.setSessionId(initialTownSessionId)

  const syncTownSessionUrl = (townSessionId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('townSessionId', townSessionId)
    history.replaceState({}, '', url.toString())
  }

  const syncTownSessionLabel = (townSessionId: string) => {
    const el = document.getElementById('town-session-label')
    if (!el) return
    el.textContent = `会话: ${formatTownSessionLabel(townSessionId)}`
    el.setAttribute('title', townSessionId)
  }

  syncTownSessionUrl(initialTownSessionId)
  syncTownSessionLabel(initialTownSessionId)

  let dataSource: IWorldDataSource
  const useMock = params.get('mock') === 'true'

  let bridgeModule: any = null
  let townWs: WebSocket | null = null
  const implicitChatPending = new Map<string, { resolve: (v: { text: string; usage?: { input: number; output: number } }) => void; timer: ReturnType<typeof setTimeout> }>()
  const seenCitizenMessageKeys = new Set<string>()
  let implicitChatSeq = 0

  if (!useMock) {
    // @ts-ignore -- resolved by Vite alias at runtime
    bridgeModule = await import('agentshire_bridge')
    const wsUrl = params.get('ws') || 'ws://localhost:55211'

    const { DirectorBridge } = bridgeModule
    const director = new DirectorBridge()

    const ws = new WebSocket(wsUrl)
    townWs = ws
    let wsReady = false
    let wsEverConnected = false

    const showWsError = () => {
      if (document.getElementById('ws-error-banner')) return
      const banner = document.createElement('div')
      banner.id = 'ws-error-banner'
      Object.assign(banner.style, {
        position: 'fixed', top: '0', left: '0', right: '0', zIndex: '9999',
        padding: '12px 16px', background: 'rgba(200,50,50,0.92)', color: '#fff',
        fontSize: '13px', lineHeight: '1.6', textAlign: 'center', fontFamily: 'system-ui, sans-serif',
      })
      banner.textContent = `无法连接 OpenClaw Gateway (${wsUrl})。请检查：1) Gateway 是否已启动  2) WebSocket 端口是否正确。确认后刷新页面即可。`
      document.body.appendChild(banner)
    }
    const hideWsError = () => {
      document.getElementById('ws-error-banner')?.remove()
    }

    const bindTownSession = (townSessionId: string) => {
      if (ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'town_session_init', townSessionId }))
    }

    const forwardCitizenMessagesToScene = (
      scene: MainScene | null,
      payload: { npcId?: string; messages?: WsHistoryMessage[] },
    ) => {
      if (!scene || typeof payload.npcId !== 'string' || !payload.npcId) return
      const assistantMessages = Array.isArray(payload.messages)
        ? payload.messages.filter((msg) => msg?.role === 'assistant')
        : []

      for (const msg of assistantMessages) {
        const text = summarizeHistoryMessage(msg)
        if (!text) continue
        const key = `${payload.npcId}:${msg.timestamp ?? 0}:${msg.type ?? 'text'}:${text}`
        if (seenCitizenMessageKeys.has(key)) continue
        seenCitizenMessageKeys.add(key)
        scene.handleGameEvent({ type: 'npc_look_at', npcId: payload.npcId, targetNpcId: 'user' })
        scene.handleGameEvent({ type: 'dialog_message', npcId: payload.npcId, text, isStreaming: false })
      }
    }

    ws.onopen = () => {
      wsReady = true
      wsEverConnected = true
      hideWsError()
      console.log('[main] DirectorBridge WS connected')
      bindTownSession(configStore.getSessionId() || initialTownSessionId)
    }

    ws.onmessage = (msg: MessageEvent) => {
      try {
        const data = JSON.parse(msg.data)
        if (data.type === 'agent_event' && data.event) {
          const evt = data.event
          if (evt.type === 'deliverable_card' || evt.type === 'media_preview') {
            if (sceneRef) sceneRef.handleGameEvent(evt)
          } else if (evt.npcId && evt.npcId !== 'steward') {
            director.processCitizenEvent(evt.npcId, evt)
          } else {
            director.processAgentEvent(evt)
          }
        } else if (data.type === 'chat_new_messages' && data.npcId) {
          forwardCitizenMessagesToScene(sceneRef, data)
        } else if (data.type === 'work_snapshot' && data.snapshot?.agents) {
          director.restoreWorkState(data.snapshot)
        } else if (data.type === 'town_session_bound' && data.townSessionId) {
          console.log(`[main] Bound to town session ${data.townSessionId}`)
          syncTownSessionLabel(data.townSessionId)
        } else if (data.type === 'implicit_chat_response' && typeof data.id === 'string') {
          const pending = implicitChatPending.get(data.id)
          if (pending) {
            implicitChatPending.delete(data.id)
            clearTimeout(pending.timer)
            pending.resolve({ text: data.text ?? '', usage: data.usage })
          }
        }
      } catch { /* ignore malformed */ }
    }

    ws.onclose = () => {
      wsReady = false
      console.log('[main] DirectorBridge WS closed')
      if (!wsEverConnected) showWsError()
    }

    const wsSend = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data))
      }
    }

    let sceneRef: MainScene | null = null

    const directorDataSource: IWorldDataSource = {
      async connect(config: any) {
        let hasWorkRestore = false
        if (sceneRef) {
          director.onEmit((events: any[]) => {
            for (const e of events) sceneRef!.handleGameEvent(e)
          })
          hasWorkRestore = director.setTownConfig(config)
        }
        return { hasWorkRestore }
      },
      disconnect() { ws.close() },
      get connected() { return wsReady },
      onGameEvent(_handler: (e: any) => void) {},
      sendAction(action: any) {
        if (action.type === 'user_message') {
          director.onUserMessage(action.text)
          const targetId = action.targetNpcId ?? 'steward'
          if (targetId !== 'steward') {
            wsSend({ type: 'citizen_chat', npcId: targetId, message: action.text })
          } else {
            const wsMsg = director.processWorldAction(action)
            if (wsMsg) wsSend(wsMsg)
            else wsSend({ type: 'chat', body: [{ kind: 'text', text: action.text }] })
          }
        } else if (action.type === 'abort_requested') {
          wsSend({ type: 'abort' })
        } else {
          const wsMsg = director.processWorldAction(action)
          if (wsMsg) wsSend(wsMsg)
        }
      },
      getSnapshot() { return null },
    }
    dataSource = directorDataSource

    ;(dataSource as any)._setScene = (s: MainScene) => { sceneRef = s }
    ;(dataSource as any)._executeRestore = () => { director.executePendingRestore() }
  } else {
    dataSource = new MockDataSource()
  }

  const scene = new MainScene(engine, dataSource, configStore)

  // Set scene reference for DirectorBridge (must be before loadScene which triggers init → startFlow → connect)
  if ((dataSource as any)._setScene) {
    (dataSource as any)._setScene(scene)
  }

  await engine.loadScene(scene)

  let implicitChatFnRef: ((req: {
    scene: string; system: string; user: string; maxTokens?: number; extraStop?: string[]
  }) => Promise<{ text: string; fallback: boolean }>) | null = null

  if (bridgeModule && townWs) {
    const IMPLICIT_CHAT_TIMEOUT_MS = 12000
    const _ws = townWs
    implicitChatFnRef = async (req: {
      scene: string; system: string; user: string; maxTokens?: number; extraStop?: string[]
    }) => {
      if (_ws.readyState !== WebSocket.OPEN) {
        const result = await bridgeModule.implicitChat({
          scene: req.scene, system: req.system, user: req.user,
          maxTokens: req.maxTokens, extraStop: req.extraStop,
        })
        return { text: result.text, fallback: result.fallback }
      }
      const id = `ic-${++implicitChatSeq}-${Date.now().toString(36)}`
      return new Promise<{ text: string; fallback: boolean }>((resolve) => {
        const timer = setTimeout(() => {
          implicitChatPending.delete(id)
          resolve({ text: '', fallback: true })
        }, IMPLICIT_CHAT_TIMEOUT_MS)
        implicitChatPending.set(id, {
          resolve: (r) => resolve({ text: r.text, fallback: !r.text }),
          timer,
        })
        _ws.send(JSON.stringify({
          type: 'implicit_chat_request',
          id,
          system: req.system,
          user: req.user,
          maxTokens: req.maxTokens ?? 200,
          temperature: 0.85,
          stop: ['\n\n', ...(req.extraStop ?? [])],
        }))
      })
    }
  }


  // ── Send function for InputBar — routes messages via dataSource ──

  const startNewTownSession = () => {
    const currentConfig = configStore.load()
    const nextTownSessionId = createTownSessionId()
    configStore.setSessionId(nextTownSessionId)
    if (currentConfig) {
      configStore.save(currentConfig)
    }
    syncTownSessionUrl(nextTownSessionId)
    syncTownSessionLabel(nextTownSessionId)

    if (window.parent !== window) {
      const parentUrl = new URL(window.parent.location.href)
      parentUrl.searchParams.set('townSessionId', nextTownSessionId)
      window.parent.location.href = parentUrl.toString()
    } else {
      window.location.reload()
    }
  }

  const sendToBackend = (msg: TownMessage): void => {
    const targetNpcId = scene.getDialogTarget()
    if (msg.type === 'chat') {
      dataSource.sendAction({ type: 'user_message', targetNpcId, text: msg.message })
    } else if (msg.type === 'multimodal') {
      const textPart = msg.parts.find(p => p.kind === 'text')
      const text = textPart && 'text' in textPart ? textPart.text : '[image]'
      dataSource.sendAction({ type: 'user_message', targetNpcId, text })
    }
  }

  // ── InputBar ──

  document.body.classList.add('has-town-panel')

  // InputBar self-binds to DOM in constructor; keep reference for potential future use
  void new InputBar({
    send: sendToBackend,
    onUserMessage: (text) => {
      scene.showUserBubble(text)
    },
    onNewSession: startNewTownSession,
  })


  const newSessionBtn = document.getElementById('town-new-session-btn')
  newSessionBtn?.addEventListener('click', startNewTownSession)

  // ── Platform Bridge ──

  const bridge = new PlatformBridge()
  bridge.onMessage((msg) => {
    switch (msg.type) {
      case 'play':
        engine.play()
        bridge.sendStateChange({ status: 'running' })
        break
      case 'pause':
        engine.pause()
        bridge.sendStateChange({ status: 'paused' })
        break
      case 'reset':
        engine.reset()
        bridge.sendStateChange({ status: 'running', tick: 0 })
        break
    }
  })

  bridge.sendReady()
  bridge.sendStateChange({ status: 'running', tick: 0, fps: 60, objectCount: 0 })

  engine.start()
  ;(window as any).engine = engine
}

main().catch(console.error)
