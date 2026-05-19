// ChatLuna 音乐工具共享类型
// 包含配置、歌曲数据、日志接口和工具输入

export type SourceMode = 'preset' | 'custom'

export type SendMode = 'audio-buffer' | 'audio-url-model' | 'audio-url' | 'file' | 'netease-card'

export interface Config {
  toolName: string
  toolDescription: string
  searchLimit: number
  sourceMode: SourceMode
  customMetingApi: string
  sendMode: SendMode
  debug: boolean
}

export interface MusicToolInput {
  query: string
  index?: number
  sendMode?: SendMode
}

export interface SilentToolResult {
  readonly lc_direct_tool_output: true
  readonly replyEmitted: true
}

export type MusicToolResult = string | SilentToolResult

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
  debug: (message: unknown, ...args: unknown[]) => void
  info: (message: unknown, ...args: unknown[]) => void
  warn: (message: string, error?: unknown) => void
  error: (message: string, error?: unknown) => void
}
