// audio-url-model 本地 302 短链服务
// 只保存短 ID 到原始音频 URL 的内存映射，不下载或代理音频内容

import { randomBytes } from 'node:crypto'

import type { Context } from 'koishi'

import type { Config, PluginLogger } from './types'

const AUDIO_SHORT_LINK_PATH = '/chatluna-music/audio'
const AUDIO_SHORT_LINK_ROUTE = `${AUDIO_SHORT_LINK_PATH}/:id`
const MAX_SHORT_LINKS = 200

interface ServerService {
  selfUrl: string
  get: (path: string, handler: (koa: AudioRedirectContext) => void | Promise<void>) => unknown
}

interface ContextWithServer {
  server: ServerService
}

interface AudioRedirectContext {
  params: {
    id?: string
  }
  status: number
  body?: unknown
  redirect: (url: string) => void
}

export interface AudioUrlRedirector {
  shorten: (targetUrl: string) => string | null
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function createShortId() {
  return randomBytes(9).toString('base64url')
}

function trimOldestShortLink(targets: Map<string, string>) {
  if (targets.size < MAX_SHORT_LINKS) return
  const oldestId = targets.keys().next().value
  if (oldestId) targets.delete(oldestId)
}

/** 注册本地 302 音频短链路由，并返回短链生成器。 */
export function registerAudioUrlRedirector(
  ctx: Context,
  config: Config,
  logger: PluginLogger
): AudioUrlRedirector | undefined {
  if (!config.enableAudioUrlModelShortLink) return undefined

  const targets = new Map<string, string>()
  let baseUrl: string | null = null

  ctx.inject(['server'], (inner) => {
    const server = (inner as unknown as ContextWithServer).server
    baseUrl = normalizeBaseUrl(config.audioShortLinkBaseUrl.trim() || server.selfUrl)

    server.get(AUDIO_SHORT_LINK_ROUTE, (koa) => {
      const id = koa.params.id
      const targetUrl = id ? targets.get(id) : undefined

      if (!targetUrl) {
        koa.status = 404
        koa.body = 'Audio URL not found'
        return
      }

      koa.redirect(targetUrl)
    })

    logger.info('已启用 audio-url-model 本地 302 短链', baseUrl)
  })

  return {
    shorten(targetUrl) {
      if (!baseUrl) return null

      trimOldestShortLink(targets)
      const id = createShortId()
      targets.set(id, targetUrl)
      return `${baseUrl}${AUDIO_SHORT_LINK_PATH}/${id}`
    }
  }
}
