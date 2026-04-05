import { getSkill, createSkillIcon } from './SkillIcons'

export class SkillLearnCard {
  private overlay: HTMLElement

  constructor() {
    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', zIndex: '500',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'none', justifyContent: 'center', alignItems: 'center',
    })
    document.body.appendChild(this.overlay)
  }

  show(slug: string, onLearn: (slug: string) => void): void {
    const skill = getSkill(slug)
    if (!skill) return

    this.overlay.innerHTML = ''
    const card = document.createElement('div')
    card.className = 'gp-card'

    const title = document.createElement('div')
    title.className = 'gp-title'
    title.textContent = '已获取新技能'

    const showcase = document.createElement('div')
    Object.assign(showcase.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '12px', marginBottom: '24px',
    })
    const icon = createSkillIcon(slug, 72)
    icon.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'
    showcase.appendChild(icon)

    const nameEl = document.createElement('div')
    Object.assign(nameEl.style, {
      color: '#fff', fontSize: '16px', fontWeight: '600', letterSpacing: '1px',
    })
    nameEl.textContent = skill.name
    showcase.appendChild(nameEl)

    const learnBtn = document.createElement('button')
    learnBtn.className = 'gp-play-btn'
    learnBtn.textContent = '立即学习'
    learnBtn.addEventListener('click', () => { this.hide(); onLearn(slug) })

    const laterBtn = document.createElement('button')
    laterBtn.className = 'gp-later'
    laterBtn.textContent = '稍后再说'
    laterBtn.addEventListener('click', () => this.hide())

    card.append(title, showcase, learnBtn, laterBtn)
    this.overlay.appendChild(card)
    this.overlay.style.display = 'flex'
    this.overlay.style.animation = 'gp-fadeIn 0.4s ease both'
  }

  hide(): void {
    this.overlay.style.display = 'none'
  }
}
