// 网易云音乐网络请求模块
// 负责搜索歌曲、解析 Meting 直链并下载音频内容

import { promises as fs } from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

import {
  DOWNLOAD_TIMEOUT_MS,
  PRESET_METING_APIS,
  REQUEST_TIMEOUT_REASON,
  SEARCH_TIMEOUT_MS,
  SOURCE_TIMEOUT_MS
} from './constants'
import type { Config, NetEaseSearchResponse, PluginLogger, SongData } from './types'

interface RequestCandidate<T> {
  label: string
  run: (signal: AbortSignal) => Promise<T>
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function createAbortTimeout(controller: AbortController, timeoutMs: number) {
  const timeout = setTimeout(() => controller.abort(REQUEST_TIMEOUT_REASON), timeoutMs)
  return () => clearTimeout(timeout)
}

async function requestText(targetUrl: string, signal: AbortSignal) {
  const response = await fetch(targetUrl, { method: 'GET', signal })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return await response.text()
}

async function requestArrayBuffer(targetUrl: string, signal: AbortSignal) {
  const response = await fetch(targetUrl, { method: 'GET', signal })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type')
  }
}

async function raceRequests<T>(
  candidates: RequestCandidate<string>[],
  timeoutMs: number,
  parser: (content: string) => T | null,
  description: string,
  logger: PluginLogger
) {
  const controllers = candidates.map(() => new AbortController())
  const tasks = candidates.map(async (candidate, index) => {
    const controller = controllers[index]
    const disposeTimeout = createAbortTimeout(controller, timeoutMs)

    try {
      logger.debug(`${description} 开始请求`, candidate.label)
      const raw = await candidate.run(controller.signal)
      const parsed = parser(raw)

      if (parsed === null) {
        throw new Error('返回结果不可用')
      }

      logger.debug(`${description} 命中`, candidate.label)
      return parsed
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason === REQUEST_TIMEOUT_REASON) {
        throw new Error(`${candidate.label} 请求超时`)
      }

      if (controller.signal.aborted) {
        throw new Error(`${candidate.label} 已取消`)
      }

      throw new Error(`${candidate.label} 请求失败：${getErrorMessage(error)}`)
    } finally {
      disposeTimeout()
    }
  })

  try {
    return await Promise.any(tasks)
  } catch (error) {
    logger.error(`${description} 全部失败`, error)
    throw error
  } finally {
    for (const controller of controllers) {
      controller.abort()
    }
  }
}

/** 校验单条搜索结果字段完整性 */
function isValidSongItem(item: unknown): item is {
  id: number
  name: string
  artists: Array<{ name: string }>
  album: { name: string }
  duration: number
} {
  if (typeof item !== 'object' || item === null) return false
  const s = item as Record<string, unknown>
  if (typeof s.id !== 'number') return false
  if (typeof s.name !== 'string') return false
  if (typeof s.duration !== 'number') return false
  if (!Array.isArray(s.artists)) return false
  if (typeof s.album !== 'object' || s.album === null) return false
  if (typeof (s.album as Record<string, unknown>).name !== 'string') return false
  for (const artist of s.artists) {
    if (typeof artist !== 'object' || artist === null) return false
    if (typeof (artist as Record<string, unknown>).name !== 'string') return false
  }
  return true
}

/** 解析网易云搜索响应为内部歌曲列表，跳过字段不完整的条目。 */
export function parseSearchResponse(content: string) {
  try {
    const parsed: unknown = JSON.parse(content)

    if (typeof parsed !== 'object' || parsed === null) return null
    const result = (parsed as Record<string, unknown>).result
    if (typeof result !== 'object' || result === null) return null
    const songs = (result as Record<string, unknown>).songs
    if (!Array.isArray(songs)) return null

    const valid: SongData[] = []

    for (const song of songs) {
      if (!isValidSongItem(song)) continue
      valid.push({
        id: song.id,
        name: song.name,
        artists: song.artists.map((artist) => artist.name).join('/'),
        albumName: song.album.name,
        duration: song.duration
      })
    }

    return valid.length > 0 ? valid : null
  } catch {
    return null
  }
}

/** 从 Meting API 响应中解析 HTTP 音频 URL。 */
export function parseMetingUrl(content: string) {
  const trimmed = content.trim()

  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed
    }
  } catch {
    // 继续尝试 JSON 格式。
  }

  try {
    const parsed = JSON.parse(trimmed) as { url?: unknown }

    if (typeof parsed.url !== 'string') {
      return null
    }

    const normalized = parsed.url.trim()
    const url = new URL(normalized)

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return normalized
    }
  } catch {
    return null
  }

  return null
}

/** 构造 Meting API 请求 URL，安全处理 query 和 hash。 */
function buildMetingUrl(baseUrl: string, songId: number) {
  const url = new URL(baseUrl)
  url.searchParams.set('type', 'url')
  url.searchParams.set('id', String(songId))
  url.hash = ''
  return url.toString()
}

function resolveExtension(contentType: string | null) {
  if (!contentType) return '.mp3'
  if (contentType.includes('audio/mpeg')) return '.mp3'
  if (contentType.includes('audio/mp4')) return '.m4a'
  if (contentType.includes('audio/wav')) return '.wav'
  if (contentType.includes('audio/flac')) return '.flac'
  return '.mp3'
}

/** 搜索网易云音乐歌曲。 */
export async function searchNetEase(
  _config: Config,
  keyword: string,
  limit: number,
  logger: PluginLogger
) {
  const searchApiUrl = `http://music.163.com/api/search/get/web?csrf_token=hlpretag=&hlposttag=&s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=${limit}`

  return await raceRequests(
    [{ label: '网易云搜索', run: (signal) => requestText(searchApiUrl, signal) }],
    SEARCH_TIMEOUT_MS,
    parseSearchResponse,
    '网易云搜索',
    logger
  )
}

/** 通过 Meting API 解析歌曲直链。 */
export async function resolveSongSource(config: Config, songId: number, logger: PluginLogger) {
  const apis = config.sourceMode === 'custom'
    ? [config.customMetingApi]
    : PRESET_METING_APIS

  const candidates = apis.map<RequestCandidate<string>>((api) => {
    const targetUrl = buildMetingUrl(api, songId)
    return {
      label: new URL(api).host,
      run: (signal) => requestText(targetUrl, signal)
    }
  })

  return await raceRequests(candidates, SOURCE_TIMEOUT_MS, parseMetingUrl, '歌曲直链获取', logger)
}

/** 下载歌曲音频为 Buffer。 */
export async function fetchSongBuffer(targetUrl: string) {
  const controller = new AbortController()
  const disposeTimeout = createAbortTimeout(controller, DOWNLOAD_TIMEOUT_MS)

  try {
    const result = await requestArrayBuffer(targetUrl, controller.signal)
    return result.buffer
  } finally {
    disposeTimeout()
    controller.abort()
  }
}

/** 下载歌曲音频为临时文件并返回文件路径。 */
export async function downloadSongFile(targetUrl: string) {
  const controller = new AbortController()
  const disposeTimeout = createAbortTimeout(controller, DOWNLOAD_TIMEOUT_MS)

  try {
    const result = await requestArrayBuffer(targetUrl, controller.signal)
    const filename = `${crypto.randomBytes(8).toString('hex')}${resolveExtension(result.contentType)}`
    const filePath = path.join(os.tmpdir(), filename)

    await fs.writeFile(filePath, result.buffer)
    return filePath
  } finally {
    disposeTimeout()
    controller.abort()
  }
}
