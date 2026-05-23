export type CategoryId = 'food' | 'drink' | 'goods' | 'service' | 'stage' | 'info'
export type StatusId = 'open' | 'prep' | 'closed'
export type ToolId = 'select' | 'add' | 'pan' | 'number'
export type ModeId = 'edit' | 'operate'
export type TileStyle = 'card' | 'badge' | 'pin'
export type GridStyle = 'lines' | 'dots' | 'none'
export type SidePos = 'left' | 'right'

export interface Tenant {
  id: string
  num: number | null
  name: string
  cat: CategoryId
  status: StatusId
  x: number
  y: number
  w: number
  h: number
  contact: string
  phone: string
  power: boolean
  size: string
  memo: string
}

export interface Category {
  id: CategoryId
  label: string
  color: string
  soft: string
}

export interface Status {
  id: StatusId
  label: string
}

export interface Structure {
  type: 'wall' | 'entrance'
  x: number
  y: number
  w: number
  h: number
  label?: string
}

export interface Zone {
  x: number
  y: number
  label: string
}

export interface TrailEntry {
  id: string
  num: number
  cx: number
  cy: number
}
