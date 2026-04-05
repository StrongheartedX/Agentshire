import { MOCK_REPLIES } from '../types'

export class MockDialog {
  private greeted = false
  private gameRequested = false

  matchReply(userText: string): { reply: string; event: string | null } {
    const text = userText.toLowerCase()

    if (!this.greeted) {
      this.greeted = true
      return { reply: MOCK_REPLIES.greeting[0], event: null }
    }

    if (!this.gameRequested && (text.includes('游戏') || text.includes('做') || text.includes('想做') || text.includes('game') || text.includes('想要'))) {
      this.gameRequested = true
      const replies = MOCK_REPLIES.game_request
      return { reply: replies[Math.floor(Math.random() * replies.length)], event: 'summon_team' }
    }

    if (text.includes('进展') || text.includes('怎么样') || text.includes('progress')) {
      return { reply: MOCK_REPLIES.progress[0], event: null }
    }

    if (text.includes('带我') || text.includes('逛逛') || text.includes('tour')) {
      const replies = MOCK_REPLIES.tour
      return { reply: replies[Math.floor(Math.random() * replies.length)], event: 'tour' }
    }

    if (text.includes('回办公') || text.includes('回去') || text.includes('office')) {
      return { reply: MOCK_REPLIES.return_office[0], event: 'return_office' }
    }

    const fallbacks = MOCK_REPLIES.fallback
    return { reply: fallbacks[Math.floor(Math.random() * fallbacks.length)], event: null }
  }

  markGreeted(): void { this.greeted = true }
  hasRequestedGame(): boolean { return this.gameRequested }
  reset(): void { this.greeted = false; this.gameRequested = false }
}
