import type { GenerationConfig } from '../types'

export const generations: GenerationConfig[] = [
  { id: 'kpop-gen1', label: 'K-pop · 1st Gen', region: 'KR', years: '1996-2003' },
  { id: 'kpop-gen2', label: 'K-pop · 2nd Gen', region: 'KR', years: '2003-2012' },
  { id: 'kpop-gen3', label: 'K-pop · 3rd Gen', region: 'KR', years: '2012-2018' },
  { id: 'kpop-gen4', label: 'K-pop · 4th Gen', region: 'KR', years: '2018-2023' },
  { id: 'kpop-gen5', label: 'K-pop · 5th Gen', region: 'KR', years: '2023-present' },
  { id: 'jpop-classic', label: 'J-pop · Classic', region: 'JP', years: '1990s-2000s' },
  { id: 'jpop-modern', label: 'J-pop · Modern', region: 'JP', years: '2010s-present' },
  { id: 'cpop-classic', label: 'C-pop · Classic', region: 'CN', years: '1990s-2000s' },
  { id: 'cpop-modern', label: 'C-pop · Modern', region: 'CN', years: '2010s-present' },
]
