// ChatLuna 音乐工具共享类型
// 包含配置、歌曲数据、日志接口和工具输入

export type SourceMode = 'preset' | 'custom'

export type SendMode = 'audio-url' | 'audio-buffer' | 'file'

export interface Config {
  toolName: string
  searchLimit: number
  sourceMode: SourceMode
  customMetingApi: string
  sendMode: SendMode
  generationTip: string
  debug: boolean
}

export interface MusicToolInput {
  query: string
}

export interface SongData {
  id: number
  name: string
  artists: string
  albumName: string
  duration: number
}

export interface NetEaseSearchResponse {
  result?: {
    songs?: NetEaseSongItem[]
  }
}

export interface NetEaseSongItem {
  id: number
  name: string
  artists: Array<{ name: string }>
  album: { name: string }
  duration: number
}

export interface PluginLogger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (message: string, error?: unknown) => void
  error: (message: string, error?: unknown) => void
}
