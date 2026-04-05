import { useState, useEffect } from 'react'

export interface AgentInfo {
  id: string
  name: string
  avatarUrl?: string
  avatarId?: string
  specialty?: string
  type: 'steward' | 'citizen'
  online?: boolean
  agentId?: string
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const resp = await fetch('/citizen-workshop/_api/load-published', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        const data = await resp.json()
        if (cancelled || !data.config) return

        const config = data.config
        const characters: any[] = config.characters ?? []
        const result: AgentInfo[] = []

        for (const entry of characters) {
          if (entry.role === 'user') continue
          const avatarUrl = entry.avatarUrl && !entry.avatarUrl.startsWith('data:') ? entry.avatarUrl : undefined
          const avatarIdRaw = entry.avatarId ?? ''
          const fallbackAvatar = avatarIdRaw && !avatarIdRaw.startsWith('custom-')
            ? `/assets/avatars/${avatarIdRaw}.webp`
            : undefined
          result.push({
            id: entry.role === 'steward' ? 'steward' : entry.id,
            name: entry.name || (entry.role === 'steward' ? '管家' : '居民'),
            avatarUrl: avatarUrl || fallbackAvatar,
            avatarId: avatarIdRaw || undefined,
            specialty: entry.role === 'steward' ? (entry.bio || 'AI 管家') : (entry.specialty || entry.industry || ''),
            type: entry.role === 'steward' ? 'steward' : 'citizen',
            online: entry.role === 'steward' ? true : !!(entry.agentEnabled && entry.agentId),
            agentId: entry.agentId,
          })
        }

        result.sort((a, b) => {
          if (a.type === 'steward') return -1
          if (b.type === 'steward') return 1
          if (a.online && !b.online) return -1
          if (!a.online && b.online) return 1
          return 0
        })

        setAgents(result)
      } catch (err) {
        console.warn('[useAgents] Failed to load:', err)
        setAgents([{ id: 'steward', name: '管家', type: 'steward', specialty: 'AI 管家', online: true }])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { agents, loading }
}
