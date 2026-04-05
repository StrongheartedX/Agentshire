// @desc NPC card panel — card display, work logs, thinking stream, todo list

import type { NPCConfig } from '../types'
import { buildAvatarEl, localizeState } from './ui-utils'
import { createLucideIcon } from './LucideIcon'

/**
 * Manages the NPC information card overlay: header, persona bio,
 * work-log entries, thinking stream, and todo list.
 */
export class NpcCardPanel {
  private npcCard: HTMLElement
  private npcCardCurrentId: string | null = null
  private npcCardLogContainer: HTMLElement | null = null
  private npcCardThinkingEl: HTMLElement | null = null
  private npcCardThinkingText: HTMLElement | null = null
  private onChatWith: ((npcId: string, label: string) => void) | null = null

  constructor(npcCard: HTMLElement) {
    this.npcCard = npcCard
    this.npcCard.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('card-close')) this.hide()
    })
  }

  setOnChatWith(fn: (npcId: string, label: string) => void): void {
    this.onChatWith = fn
  }

  show(opts: {
    npc: NPCConfig; state: string; specialty?: string; persona?: string;
    workLogs?: Array<{ type: string; icon: string; message: string; time?: string }>;
    agentOnline?: boolean;
    isWorking?: boolean;
  }): void {
    if (!this.npcCard) return

    if (this.npcCardCurrentId === opts.npc.id && this.npcCard.style.display === 'block') {
      this.hide()
      return
    }
    this.npcCardCurrentId = opts.npc.id
    this.npcCardThinkingEl = null
    this.npcCardThinkingText = null
    this.npcCard.innerHTML = ''

    const hasLogs = opts.workLogs && opts.workLogs.length > 0
    this.npcCard.classList.toggle('has-logs', !!hasLogs)

    const close = document.createElement('button')
    close.className = 'card-close'
    const closeIcon = createLucideIcon('x', 16, 'currentColor')
    if (closeIcon) close.appendChild(closeIcon)
    close.onclick = () => this.hide()
    this.npcCard.appendChild(close)

    const header = document.createElement('div')
    header.className = 'card-header'
    const av = buildAvatarEl('card-avatar', opts.npc, 48)
    const info = document.createElement('div')
    info.className = 'card-info'
    const nm = document.createElement('div')
    nm.className = 'card-name'
    nm.textContent = opts.npc.label || opts.npc.name
    if (opts.agentOnline !== undefined) {
      const dot = document.createElement('span')
      dot.className = opts.agentOnline ? 'card-status-dot online' : 'card-status-dot offline'
      nm.appendChild(dot)
    }
    const meta = document.createElement('div')
    meta.className = 'card-meta'
    const parts: string[] = []
    if (opts.specialty) parts.push(opts.specialty)
    parts.push(localizeState(opts.state))
    meta.textContent = parts.join(' · ')
    info.appendChild(nm)
    info.appendChild(meta)
    header.appendChild(av)
    header.appendChild(info)

    const headerActions = document.createElement('div')
    headerActions.className = 'card-header-actions'

    if (opts.npc.id !== 'steward' && opts.npc.id !== 'user') {
      const chatBtn = document.createElement('button')
      chatBtn.className = 'card-chat-btn'
      const chatIcon = createLucideIcon('message-circle', 13, 'currentColor')
      if (chatIcon) chatBtn.appendChild(chatIcon)
      const chatLabel = document.createElement('span')
      chatLabel.textContent = '聊天'
      chatBtn.appendChild(chatLabel)

      const canChat = opts.agentOnline && !opts.isWorking
      if (!canChat) {
        chatBtn.disabled = true
        chatBtn.title = opts.isWorking ? '对方正在专心工作' : '对方不在线'
      } else {
        chatBtn.onclick = () => {
          this.onChatWith?.(opts.npc.id, opts.npc.label || opts.npc.name)
          this.hide()
        }
      }
      headerActions.appendChild(chatBtn)
    }

    header.appendChild(headerActions)
    this.npcCard.appendChild(header)

    if (opts.persona) {
      const bio = document.createElement('div')
      bio.className = 'card-bio'
      bio.textContent = opts.persona
      this.npcCard.appendChild(bio)
    }

    if (hasLogs) {
      const area = this.buildLogArea(opts.workLogs!)
      this.npcCard.appendChild(area)
      requestAnimationFrame(() => {
        if (this.npcCardLogContainer) this.npcCardLogContainer.scrollTop = this.npcCardLogContainer.scrollHeight
      })
    } else {
      this.npcCardLogContainer = null
    }

    this.npcCard.style.display = 'flex'
  }

  appendActivity(npcId: string, log: { type: string; icon: string; message: string; time?: string; status?: boolean | null }): void {
    if (this.npcCardCurrentId !== npcId) return
    if (!this.npcCardLogContainer) {
      const area = this.buildLogArea([])
      this.npcCard.appendChild(area)
      this.npcCard.classList.add('has-logs')
    }
    const isPlaceholder = log.message === '正在思考'
    const oldPlaceholder = this.npcCardLogContainer!.querySelector('.thinking-placeholder')
    if (oldPlaceholder && !isPlaceholder) {
      oldPlaceholder.remove()
    }
    if (isPlaceholder && oldPlaceholder) return
    const el = this.createLogEl(log)
    if (isPlaceholder) el.classList.add('thinking-placeholder')
    if (log.type === 'thinking') {
      this.npcCardThinkingEl = el
      this.npcCardThinkingText = el.querySelector('.log-msg')
    }
    this.npcCardLogContainer!.appendChild(el)
    this.npcCardLogContainer!.scrollTop = this.npcCardLogContainer!.scrollHeight
  }

  appendThinkingDelta(npcId: string, delta: string): void {
    if (this.npcCardCurrentId !== npcId || !this.npcCardThinkingText) return
    this.npcCardThinkingText.textContent += delta
    if (this.npcCardLogContainer) {
      this.npcCardLogContainer.scrollTop = this.npcCardLogContainer.scrollHeight
    }
  }

  endThinkingStream(npcId: string): void {
    if (this.npcCardCurrentId !== npcId || !this.npcCardThinkingEl) return
    this.npcCardThinkingEl.classList.remove('thinking-active')
    this.npcCardThinkingEl.classList.add('thinking-done')
    const iconWrap = this.npcCardThinkingEl.querySelector('.log-icon')
    if (iconWrap) {
      iconWrap.innerHTML = ''
      const doneIcon = createLucideIcon('check-circle', 14, 'rgba(0,200,120,0.8)')
      if (doneIcon) iconWrap.appendChild(doneIcon)
    }
    this.npcCardThinkingEl = null
    this.npcCardThinkingText = null
  }

  updateLastActivityStatus(npcId: string, success: boolean): void {
    if (this.npcCardCurrentId !== npcId || !this.npcCardLogContainer) return
    const entries = this.npcCardLogContainer.querySelectorAll('.card-log-entry:not(.thinking-active):not(.thinking-done):not(.thinking-placeholder)')
    let target: Element | null = null
    for (let i = 0; i < entries.length; i++) {
      const statusEl = entries[i].querySelector('.log-status-pending')
      if (statusEl) { target = entries[i]; break; }
    }
    if (!target) return
    const statusEl = target.querySelector('.log-status')
    if (!statusEl) return
    statusEl.innerHTML = ''
    statusEl.className = 'log-status'
    const icon = createLucideIcon(success ? 'check' : 'x', 14, success ? 'rgba(0,200,120,0.8)' : 'rgba(255,80,80,0.8)')
    if (icon) statusEl.appendChild(icon)
  }

  appendTodoList(npcId: string, todos: Array<{ id: number; content: string; status: string }>): void {
    if (this.npcCardCurrentId !== npcId) return
    if (!this.npcCardLogContainer) {
      const area = this.buildLogArea([])
      this.npcCard.appendChild(area)
      this.npcCard.classList.add('has-logs')
    }
    const existing = this.npcCardLogContainer!.querySelector('.log-todo-block')
    if (existing) {
      this.updateTodoBlock(existing as HTMLElement, todos)
    } else {
      const block = this.createTodoBlock(todos)
      this.npcCardLogContainer!.appendChild(block)
    }
    this.npcCardLogContainer!.scrollTop = this.npcCardLogContainer!.scrollHeight
  }

  hide(): void {
    if (!this.npcCard) return
    this.npcCard.style.display = 'none'
    this.npcCard.classList.remove('has-logs')
    this.npcCardCurrentId = null
    this.npcCardLogContainer = null
    this.npcCardThinkingEl = null
    this.npcCardThinkingText = null
  }

  // ── private helpers ──

  private createTodoBlock(todos: Array<{ id: number; content: string; status: string }>): HTMLElement {
    const block = document.createElement('div')
    block.className = 'card-log-entry log-todo-block'
    const header = document.createElement('div')
    header.className = 'log-todo-header'
    const icon = createLucideIcon('list-checks', 14, 'rgba(255,255,255,0.45)')
    if (icon) header.appendChild(icon)
    const label = document.createElement('span')
    label.textContent = '任务列表'
    header.appendChild(label)
    block.appendChild(header)
    const list = document.createElement('div')
    list.className = 'log-todo-list'
    for (const t of todos) {
      list.appendChild(this.createTodoItem(t))
    }
    block.appendChild(list)
    return block
  }

  private createTodoItem(t: { id: number; content: string; status: string }): HTMLElement {
    const row = document.createElement('div')
    row.className = 'log-todo-item'
    row.dataset.todoId = String(t.id)
    const text = document.createElement('span')
    text.className = 'log-todo-text'
    text.textContent = t.content
    row.appendChild(text)
    const st = document.createElement('span')
    st.className = 'log-todo-status'
    this.setTodoStatusIcon(st, t.status)
    row.appendChild(st)
    return row
  }

  private setTodoStatusIcon(el: HTMLElement, status: string): void {
    el.innerHTML = ''
    if (status === 'completed') {
      const ic = createLucideIcon('check', 12, 'rgba(0,200,120,0.8)')
      if (ic) el.appendChild(ic)
    } else if (status === 'in_progress') {
      const ic = createLucideIcon('loader', 12, 'rgba(255,255,255,0.3)')
      if (ic) { ic.classList.add('todo-spin'); el.appendChild(ic) }
    }
  }

  private updateTodoBlock(block: HTMLElement, todos: Array<{ id: number; content: string; status: string }>): void {
    const list = block.querySelector('.log-todo-list')
    if (!list) return
    for (const t of todos) {
      const existing = list.querySelector(`[data-todo-id="${t.id}"]`) as HTMLElement | null
      if (existing) {
        const textEl = existing.querySelector('.log-todo-text')
        if (textEl && t.content) textEl.textContent = t.content
        const stEl = existing.querySelector('.log-todo-status') as HTMLElement
        if (stEl) this.setTodoStatusIcon(stEl, t.status)
      } else {
        list.appendChild(this.createTodoItem(t))
      }
    }
  }

  private buildLogArea(logs: Array<{ type: string; icon: string; message: string; time?: string; status?: boolean | null }>): HTMLElement {
    const area = document.createElement('div')
    area.className = 'card-log-area'
    const title = document.createElement('div')
    title.className = 'card-log-area-title'
    title.textContent = '最近工作日志'
    area.appendChild(title)
    const list = document.createElement('div')
    list.className = 'card-log-list'
    for (const log of logs) {
      list.appendChild(this.createLogEl(log))
    }
    area.appendChild(list)
    this.npcCardLogContainer = list
    return area
  }

  private createLogEl(log: { type: string; icon: string; message: string; time?: string; status?: boolean | null }): HTMLElement {
    const el = document.createElement('div')
    el.className = 'card-log-entry'
    if (log.type === 'thinking') el.classList.add('thinking-active')

    if (log.time) {
      const timeEl = document.createElement('span')
      timeEl.className = 'log-time'
      timeEl.textContent = log.time
      el.appendChild(timeEl)
    }

    const iconWrap = document.createElement('span')
    iconWrap.className = 'log-icon'
    const color = log.type === 'thinking' ? 'rgba(0,212,255,0.7)' :
      log.icon === 'alert-circle' ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.45)'
    const svg = createLucideIcon(log.icon, 14, color)
    if (svg) iconWrap.appendChild(svg)
    el.appendChild(iconWrap)

    const hasDetail = log.message.includes('\n')
    const mainText = hasDetail ? log.message.split('\n')[0] : log.message
    const detailText = hasDetail ? log.message.split('\n').slice(1).join('\n') : ''

    const msgWrap = document.createElement('div')
    msgWrap.className = 'log-msg-wrap'

    const msg = document.createElement('span')
    msg.className = 'log-msg'
    msg.textContent = mainText
    msgWrap.appendChild(msg)

    if (detailText) {
      const detail = document.createElement('div')
      detail.className = 'log-detail collapsed'
      detail.textContent = detailText
      msgWrap.appendChild(detail)

      requestAnimationFrame(() => {
        if (detail.scrollHeight > detail.clientHeight + 2) {
          const toggle = document.createElement('span')
          toggle.className = 'log-status log-detail-toggle'
          const chevDown = createLucideIcon('chevron-down', 12, 'rgba(255,255,255,0.35)')
          if (chevDown) toggle.appendChild(chevDown)
          toggle.onclick = (e) => {
            e.stopPropagation()
            const isCollapsed = detail.classList.contains('collapsed')
            detail.classList.toggle('collapsed')
            toggle.innerHTML = ''
            const icon = createLucideIcon(isCollapsed ? 'chevron-up' : 'chevron-down', 12, 'rgba(255,255,255,0.35)')
            if (icon) toggle.appendChild(icon)
          }
          el.appendChild(toggle)
        }
      })
    }

    el.appendChild(msgWrap)

    if (log.status === null) {
      // no status icon
    } else if (log.status === true) {
      const st = document.createElement('span')
      st.className = 'log-status'
      const ic = createLucideIcon('check', 12, 'rgba(0,200,120,0.8)')
      if (ic) st.appendChild(ic)
      el.appendChild(st)
    } else if (log.status === false) {
      const st = document.createElement('span')
      st.className = 'log-status'
      const ic = createLucideIcon('x', 12, 'rgba(255,80,80,0.8)')
      if (ic) st.appendChild(ic)
      el.appendChild(st)
    } else {
      const st = document.createElement('span')
      st.className = 'log-status log-status-pending'
      const loader = createLucideIcon('loader', 12, 'rgba(255,255,255,0.3)')
      if (loader) st.appendChild(loader)
      el.appendChild(st)
    }

    return el
  }
}
