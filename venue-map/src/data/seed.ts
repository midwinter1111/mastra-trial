import type { Tenant, Category, Status, Structure, Zone } from '@/types'

export const VENUE_WIDTH = 1600
export const VENUE_HEIGHT = 1000

export const VENUE_BOUNDS = { minX: 64, minY: 44, maxX: 1536, maxY: 956 }

export interface Entrance {
  wall: 'top' | 'bottom' | 'left' | 'right'
  from: number
  to: number
  label: string
}

export const VENUE_ENTRANCES: Entrance[] = [
  { wall: 'top',    from: 740, to: 860, label: '正面入口' },
  { wall: 'bottom', from: 740, to: 860, label: '南口' },
  { wall: 'left',   from: 720, to: 840, label: '搬入口' },
]

export const CATEGORIES: Category[] = [
  { id: 'food',    label: '飲食',      color: '#d75e4a', soft: '#fae3dc' },
  { id: 'drink',   label: 'ドリンク',  color: '#4d8db8', soft: '#dde9f1' },
  { id: 'goods',   label: '物販',      color: '#c89344', soft: '#faecd0' },
  { id: 'service', label: 'サービス',  color: '#6a9d6f', soft: '#ddeadd' },
  { id: 'stage',   label: 'ステージ',  color: '#9460b8', soft: '#eadff2' },
  { id: 'info',    label: 'インフォ',  color: '#7b7665', soft: '#ebe7da' },
]

export function getCategoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]
}

export const STATUSES: Status[] = [
  { id: 'open',   label: '営業中' },
  { id: 'prep',   label: '準備中' },
  { id: 'closed', label: '閉店' },
]

export const INITIAL_TENANTS: Tenant[] = [
  { id: 't01', num: 1,    name: '炭火焼鳥 とり源',       cat: 'food',    status: 'open',   x: 140,  y: 200, w: 120, h: 100, contact: '山田 太郎',   phone: '090-1234-5678', power: true,  size: '1.2 x 1.0m', memo: '深夜帯は煙対策を強化。換気扇追加要。' },
  { id: 't02', num: 2,    name: '石窯ピッツァ Forno',     cat: 'food',    status: 'open',   x: 280,  y: 200, w: 120, h: 100, contact: '佐藤 美咲',   phone: '080-2345-6789', power: true,  size: '1.2 x 1.0m', memo: '' },
  { id: 't03', num: 3,    name: '讃岐うどん 麦の音',      cat: 'food',    status: 'prep',   x: 420,  y: 200, w: 120, h: 100, contact: '鈴木 健一',   phone: '090-3456-7890', power: true,  size: '1.2 x 1.0m', memo: '11:00開店予定。' },
  { id: 't04', num: 4,    name: '本格タコス Cocina',      cat: 'food',    status: 'open',   x: 560,  y: 200, w: 120, h: 100, contact: 'Maria L.',   phone: '070-4567-8901', power: true,  size: '1.2 x 1.0m', memo: '' },
  { id: 't05', num: 5,    name: 'ベトナム麺 Pho 33',      cat: 'food',    status: 'open',   x: 700,  y: 200, w: 120, h: 100, contact: '高橋 翔',     phone: '090-5678-9012', power: true,  size: '1.2 x 1.0m', memo: '' },
  { id: 't10', num: 10,   name: 'クラフトビール HOP',     cat: 'drink',   status: 'open',   x: 140,  y: 360, w: 140, h: 80,  contact: '井上 涼',     phone: '080-6789-0123', power: true,  size: '1.4 x 0.8m', memo: '20歳未満販売不可。確認用ID必須。' },
  { id: 't11', num: 11,   name: 'ワインバル Vino',        cat: 'drink',   status: 'open',   x: 300,  y: 360, w: 140, h: 80,  contact: 'Marco R.',   phone: '070-7890-1234', power: true,  size: '1.4 x 0.8m', memo: '' },
  { id: 't12', num: 12,   name: 'コーヒースタンド HUE',   cat: 'drink',   status: 'open',   x: 460,  y: 360, w: 120, h: 80,  contact: '中村 葵',     phone: '090-8901-2345', power: true,  size: '1.2 x 0.8m', memo: '' },
  { id: 't30', num: null, name: 'メインステージ',         cat: 'stage',   status: 'open',   x: 900,  y: 200, w: 280, h: 180, contact: 'イベント本部', phone: '03-1234-5678',  power: true,  size: '5.6 x 3.6m', memo: 'PA卓は北西角に設置。リハーサル 9:00-10:30。' },
  { id: 't20', num: 20,   name: 'クラフト雑貨 Lin',       cat: 'goods',   status: 'open',   x: 1280, y: 200, w: 100, h: 100, contact: '森 ひかり',   phone: '080-9012-3456', power: false, size: '1.0 x 1.0m', memo: '' },
  { id: 't21', num: 21,   name: 'アクセサリー Stella',    cat: 'goods',   status: 'open',   x: 1280, y: 320, w: 100, h: 100, contact: 'Olivia P.',  phone: '070-0123-4567', power: false, size: '1.0 x 1.0m', memo: '' },
  { id: 't22', num: 22,   name: '古書とZINE 余白',        cat: 'goods',   status: 'prep',   x: 1280, y: 440, w: 100, h: 100, contact: '藤本 玲',     phone: '090-1357-2468', power: false, size: '1.0 x 1.0m', memo: '搬入が遅れ気味。要確認。' },
  { id: 't23', num: 23,   name: '陶芸工房 KAMA',          cat: 'goods',   status: 'open',   x: 1280, y: 560, w: 100, h: 100, contact: '陶山 修',     phone: '080-2468-1357', power: false, size: '1.0 x 1.0m', memo: '' },
  { id: 't40', num: 40,   name: 'ワークショップ A',       cat: 'service', status: 'open',   x: 600,  y: 580, w: 180, h: 140, contact: '篠崎 拓海',   phone: '090-3691-2580', power: true,  size: '1.8 x 1.4m', memo: 'ハンドメイド体験。1セッション 45分。' },
  { id: 't41', num: 41,   name: 'ワークショップ B',       cat: 'service', status: 'prep',   x: 820,  y: 580, w: 180, h: 140, contact: '西村 萌',     phone: '080-4702-3691', power: true,  size: '1.8 x 1.4m', memo: '' },
  { id: 't50', num: 0,    name: '総合インフォメーション', cat: 'info',    status: 'open',   x: 560,  y: 60,  w: 160, h: 80,  contact: '受付 本部',   phone: '03-9876-5432',  power: true,  size: '1.6 x 0.8m', memo: '迷子・落とし物の窓口を兼務。' },
  { id: 't51', num: 99,   name: '救護所',                 cat: 'info',    status: 'open',   x: 1280, y: 60,  w: 100, h: 80,  contact: '看護師 当番', phone: '03-0001-0002',  power: true,  size: '1.0 x 0.8m', memo: 'AED 設置。' },
  { id: 't60', num: null, name: 'ポップアップ枠 #1',      cat: 'goods',   status: 'prep',   x: 140,  y: 580, w: 100, h: 100, contact: '未定',        phone: '—',             power: false, size: '1.0 x 1.0m', memo: '出店者調整中。' },
]

export const UNPLACED_TENANTS: Tenant[] = [
  { id: 'u01', name: '出店候補 A — 焼菓子工房 ふくら', cat: 'food',  status: 'prep', num: null, x: 0, y: 0, w: 100, h: 100, contact: '', phone: '', power: true,  size: '1.0 x 1.0m', memo: '' },
  { id: 'u02', name: '出店候補 B — 紅茶専門 LEAF',     cat: 'drink', status: 'prep', num: null, x: 0, y: 0, w: 100, h: 80,  contact: '', phone: '', power: true,  size: '1.0 x 0.8m', memo: '' },
  { id: 'u03', name: '出店候補 C — ハーブ苗 Mint',     cat: 'goods', status: 'prep', num: null, x: 0, y: 0, w: 100, h: 100, contact: '', phone: '', power: false, size: '1.0 x 1.0m', memo: '' },
]

export const STRUCTURES: Structure[] = [
  { type: 'wall',     x: 60,   y: 40,   w: 1480, h: 4 },
  { type: 'wall',     x: 60,   y: 40,   w: 4,    h: 920 },
  { type: 'wall',     x: 1536, y: 40,   w: 4,    h: 920 },
  { type: 'wall',     x: 60,   y: 956,  w: 1480, h: 4 },
  { type: 'wall',     x: 60,   y: 480,  w: 480,  h: 2 },
  { type: 'entrance', x: 740,  y: 30,   w: 120,  h: 20,  label: '正面入口' },
  { type: 'entrance', x: 740,  y: 950,  w: 120,  h: 20,  label: '南口' },
  { type: 'entrance', x: 50,   y: 720,  w: 20,   h: 120, label: '搬入口' },
]

export const ZONES: Zone[] = [
  { x: 140,  y: 168, label: 'Aゾーン  /  フードエリア',    minX: 140,  maxX: 860,  minY: 168, maxY: 480 },
  { x: 900,  y: 168, label: 'Bゾーン  /  メインステージ',  minX: 900,  maxX: 1180, minY: 168, maxY: 420 },
  { x: 1280, y: 168, label: 'Cゾーン  /  物販',            minX: 1280, maxX: 1536, minY: 168, maxY: 760 },
  { x: 600,  y: 548, label: 'Dゾーン  /  ワークショップ',  minX: 600,  maxX: 1000, minY: 548, maxY: 760 },
  { x: 140,  y: 548, label: 'Eゾーン  /  ポップアップ',    minX: 140,  maxX: 380,  minY: 548, maxY: 760 },
]
