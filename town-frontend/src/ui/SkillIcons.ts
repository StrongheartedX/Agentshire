import { icons } from 'lucide'
import catalog from '../data/skill-catalog.json'

type IconNode = [string, Record<string, string>][]

interface CategoryDef {
  label: string
  gradient: string[]
}

export interface SkillEntry {
  slug: string
  name: string
  category: string
  icon: string
  desc: string
  downloads: number
  stars: number
  installs: number
}

const categories = catalog.categories as Record<string, CategoryDef>
const skills = catalog.skills as SkillEntry[]

const skillMap = new Map<string, SkillEntry>()
for (const s of skills) skillMap.set(s.slug, s)

export function getSkill(slug: string): SkillEntry | undefined {
  return skillMap.get(slug)
}

export function getAllSkills(): SkillEntry[] {
  return skills
}

export function getSkillsByCategory(cat: string): SkillEntry[] {
  return skills.filter(s => s.category === cat)
}

export function getCategoryDef(cat: string): CategoryDef | undefined {
  return categories[cat]
}

export function getAllCategories(): Record<string, CategoryDef> {
  return categories
}

function kebabToPascal(s: string): string {
  return s.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

function buildSvgElement(iconName: string, size = 24, color = '#fff'): SVGSVGElement | null {
  const pascal = kebabToPascal(iconName)
  const iconData = (icons as Record<string, IconNode>)[pascal]
  if (!iconData) return null

  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('xmlns', ns)
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', color)
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')

  for (const [tag, attrs] of iconData) {
    const el = document.createElementNS(ns, tag)
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v)
    }
    svg.appendChild(el)
  }
  return svg
}

export function createSkillIcon(slug: string, size = 48): HTMLElement {
  const skill = skillMap.get(slug)
  const container = document.createElement('div')

  const iconSize = Math.round(size * 0.5)
  const radius = Math.round(size * 0.22)

  container.style.cssText = `
    width: ${size}px; height: ${size}px; border-radius: ${radius}px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  `

  if (skill) {
    const cat = categories[skill.category]
    const [c1, c2] = cat?.gradient ?? ['#667eea', '#764ba2']
    container.style.background = `linear-gradient(135deg, ${c1}, ${c2})`
    const svg = buildSvgElement(skill.icon, iconSize)
    if (svg) {
      container.appendChild(svg)
    } else {
      const fallback = document.createElement('span')
      fallback.textContent = skill.name.charAt(0).toUpperCase()
      fallback.style.cssText = `color: #fff; font-weight: 700; font-size: ${iconSize}px; line-height: 1;`
      container.appendChild(fallback)
    }
  } else {
    container.style.background = 'linear-gradient(135deg, #667eea, #764ba2)'
    const fallback = document.createElement('span')
    fallback.textContent = '?'
    fallback.style.cssText = `color: #fff; font-weight: 700; font-size: ${iconSize}px; line-height: 1;`
    container.appendChild(fallback)
  }

  return container
}

export function createSkillCard(slug: string): HTMLElement {
  const skill = skillMap.get(slug)
  const card = document.createElement('div')
  card.className = 'skill-card'

  const icon = createSkillIcon(slug, 44)

  const info = document.createElement('div')
  info.className = 'skill-card-info'

  const name = document.createElement('div')
  name.className = 'skill-card-name'
  name.textContent = skill?.name ?? slug

  const desc = document.createElement('div')
  desc.className = 'skill-card-desc'
  desc.textContent = skill?.desc ?? ''

  const stats = document.createElement('div')
  stats.className = 'skill-card-stats'
  if (skill) {
    stats.innerHTML = `
      <span class="stat">↓ ${formatNum(skill.downloads)}</span>
      <span class="stat">☆ ${formatNum(skill.stars)}</span>
      <span class="stat">⊕ ${formatNum(skill.installs)}</span>
    `
  }

  info.appendChild(name)
  info.appendChild(desc)
  info.appendChild(stats)

  card.appendChild(icon)
  card.appendChild(info)

  return card
}

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
