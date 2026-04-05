import townDefaults from './town-defaults.json'
import type { ModelTransform, AnimMapping, PublishedCitizenConfig } from './CitizenWorkshopConfig'
import { createDefaultModelTransform } from './CitizenWorkshopConfig'

export interface StewardConfig {
  name: string
  persona: string
  avatarId: string
  avatarUrl?: string
  modelUrl?: string
  modelTransform?: ModelTransform
  animMapping?: AnimMapping
  animFileUrls?: string[]
}

export interface CitizenConfig {
  id: string
  name: string
  specialty: string
  persona: string
  avatarId: string
  avatarUrl?: string
  homeId: string
  modelUrl?: string
  modelTransform?: ModelTransform
  animMapping?: AnimMapping
  animFileUrls?: string[]
}

export interface UserConfig {
  name: string
  avatarId: string
  avatarUrl?: string
  modelUrl?: string
  modelTransform?: ModelTransform
  animMapping?: AnimMapping
  animFileUrls?: string[]
}

export interface TownConfig {
  townName: string
  steward: StewardConfig
  user: UserConfig
  citizens: CitizenConfig[]
  createdAt: number
  version: number
}

const LEGACY_SPECIALTY_LABELS: Record<string, string> = {
  architecture: '架构',
  planning: '策划',
  design: '设计',
  programming: '开发',
  writing: '内容创作',
  data: '数据分析',
  general: '通用',
}

export const SPECIALTY_LABELS = LEGACY_SPECIALTY_LABELS

export function getSpecialtyLabel(specialty: string): string {
  return LEGACY_SPECIALTY_LABELS[specialty] ?? specialty
}

export function createDefaultTownConfig(): TownConfig {
  return {
    townName: townDefaults.townName,
    steward: {
      name: townDefaults.steward.name,
      persona: extractSoulId(townDefaults.steward.personaFile),
      avatarId: townDefaults.steward.characterKey,
    },
    user: {
      name: townDefaults.user.name,
      avatarId: townDefaults.user.characterKey,
    },
    citizens: townDefaults.citizens.map(c => ({
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      persona: extractSoulId(c.personaFile),
      avatarId: c.characterKey,
      homeId: c.homeId,
    })),
    createdAt: Date.now(),
    version: 4,
  }
}

export function publishedToTownView(published: PublishedCitizenConfig): TownConfig {
  const stewardEntry = published.characters.find(c => c.role === 'steward')
  const userEntry = published.characters.find(c => c.role === 'user')
  const citizenEntries = published.characters.filter(c => c.role === 'citizen')

  return {
    townName: '夏尔小镇',
    steward: {
      name: stewardEntry?.name ?? 'OpenClaw',
      persona: stewardEntry?.persona ?? '',
      avatarId: stewardEntry?.avatarId ?? 'char-female-b',
      avatarUrl: stewardEntry?.avatarUrl,
      modelUrl: stewardEntry?.modelUrl,
      modelTransform: stewardEntry?.modelTransform,
      animMapping: stewardEntry?.animMapping,
      animFileUrls: stewardEntry?.animFileUrls,
    },
    user: {
      name: userEntry?.name ?? '镇长',
      avatarId: userEntry?.avatarId ?? 'char-male-c',
      avatarUrl: userEntry?.avatarUrl,
      modelUrl: userEntry?.modelUrl,
      modelTransform: userEntry?.modelTransform,
      animMapping: userEntry?.animMapping,
      animFileUrls: userEntry?.animFileUrls,
    },
    citizens: citizenEntries.map(c => ({
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      persona: c.persona,
      avatarId: c.avatarId,
      avatarUrl: c.avatarUrl,
      homeId: c.homeId,
      modelUrl: c.modelUrl,
      modelTransform: c.modelTransform,
      animMapping: c.animMapping,
      animFileUrls: c.animFileUrls,
    })),
    createdAt: Date.now(),
    version: 4,
  }
}

export interface NPCProfile {
  name: string
  specialty: string
  bio: string
}

export function getNpcProfiles(): Map<string, NPCProfile> {
  const map = new Map<string, NPCProfile>()
  const s = townDefaults.steward as any
  map.set(s.id, { name: s.name, specialty: s.specialty ?? '管家', bio: s.bio ?? '' })
  const u = townDefaults.user as any
  map.set(u.id, { name: u.name, specialty: u.specialty ?? '镇长', bio: u.bio ?? '' })
  for (const c of townDefaults.citizens) {
    const ca = c as any
    map.set(c.id, {
      name: c.name,
      specialty: getSpecialtyLabel(c.specialty),
      bio: ca.bio ?? '',
    })
  }
  return map
}

export function extractSoulId(personaFile: string): string {
  const base = personaFile.split('/').pop() ?? ''
  return base.replace(/\.md$/i, '')
}
