// 本地音频短链测试
// 验证 audio-url-model 使用的 302 短链注册、生成和跳转逻辑

import { describe, expect, it, vi } from 'vitest'

import { registerAudioUrlRedirector } from '../src/short-link'
import type { Config, PluginLogger } from '../src/types'

const config: Config = {
  toolName: 'music_voice',
  toolDescription: '自定义音乐工具描述。',
  searchLimit: 5,
  enableNetEaseSearch: true,
  enableQQMusicSearch: false,
  allowAISendMode: true,
  enableAudioUrlModelShortLink: true,
  audioShortLinkBaseUrl: '',
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  debug: false
}

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('registerAudioUrlRedirector', () => {
  it('returns undefined when local 302 short link is disabled', () => {
    const ctx = { inject: vi.fn() }

    expect(registerAudioUrlRedirector(ctx as never, {
      ...config,
      enableAudioUrlModelShortLink: false
    }, logger)).toBeUndefined()
    expect(ctx.inject).not.toHaveBeenCalled()
  })

  it('creates a local short URL and redirects it to the original audio URL', async () => {
    const routes: Array<{ path: string, handler: (koa: any) => Promise<void> | void }> = []
    const ctx = {
      inject: vi.fn((_services: string[], callback: (inner: unknown) => void) => {
        callback({
          server: {
            selfUrl: 'http://127.0.0.1:5140',
            get(path: string, handler: (koa: any) => Promise<void> | void) {
              routes.push({ path, handler })
            }
          }
        })
      })
    }

    const redirector = registerAudioUrlRedirector(ctx as never, config, logger)
    const shortUrl = redirector?.shorten('https://cdn.example.com/song.mp3?token=long')

    expect(shortUrl).toMatch(/^http:\/\/127\.0\.0\.1:5140\/chatluna-music\/audio\/[a-zA-Z0-9_-]+$/)
    expect(routes[0].path).toBe('/chatluna-music/audio/:id')

    const id = new URL(shortUrl!).pathname.split('/').pop()
    const koa = {
      params: { id },
      redirect: vi.fn(),
      status: 200,
      body: undefined
    }

    await routes[0].handler(koa)

    expect(koa.redirect).toHaveBeenCalledWith('https://cdn.example.com/song.mp3?token=long')
  })

  it('uses configured LAN base URL for generated short links', () => {
    const routes: Array<{ path: string, handler: (koa: any) => Promise<void> | void }> = []
    const ctx = {
      inject: vi.fn((_services: string[], callback: (inner: unknown) => void) => {
        callback({
          server: {
            selfUrl: 'http://127.0.0.1:5140',
            get(path: string, handler: (koa: any) => Promise<void> | void) {
              routes.push({ path, handler })
            }
          }
        })
      })
    }

    const redirector = registerAudioUrlRedirector(ctx as never, {
      ...config,
      audioShortLinkBaseUrl: 'http://192.168.1.10:5140/'
    }, logger)

    expect(redirector?.shorten('https://cdn.example.com/song.mp3'))
      .toMatch(/^http:\/\/192\.168\.1\.10:5140\/chatluna-music\/audio\/[a-zA-Z0-9_-]+$/)
  })

  it('returns null before Koishi server route is available', () => {
    const ctx = {
      inject: vi.fn()
    }

    const redirector = registerAudioUrlRedirector(ctx as never, config, logger)

    expect(redirector?.shorten('https://cdn.example.com/song.mp3')).toBeNull()
  })
})
