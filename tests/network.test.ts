// 网络模块测试
// 验证网易云搜索解析、Meting URL 解析和下载能力

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Config, PluginLogger } from '../src/types'
import {
  fetchSongBuffer,
  parseMetingUrl,
  parseSearchResponse,
  resolveSongSource,
  searchNetEase
} from '../src/network'

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const baseConfig: Config = {
  toolName: 'play_netease_music_as_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('parseSearchResponse', () => {
  it('converts NetEase songs to SongData', () => {
    const result = parseSearchResponse(JSON.stringify({
      result: {
        songs: [{
          id: 186016,
          name: '晴天',
          artists: [{ name: '周杰伦' }],
          album: { name: '叶惠美' },
          duration: 269000
        }]
      }
    }))

    expect(result).toEqual([{
      id: 186016,
      name: '晴天',
      artists: '周杰伦',
      albumName: '叶惠美',
      duration: 269000
    }])
  })

  it('returns null for invalid search JSON', () => {
    expect(parseSearchResponse('not json')).toBeNull()
  })
})

describe('parseMetingUrl', () => {
  it('parses a plain URL response', () => {
    expect(parseMetingUrl('https://cdn.example.com/song.mp3')).toBe('https://cdn.example.com/song.mp3')
  })

  it('parses a JSON URL response', () => {
    expect(parseMetingUrl('{"url":"https://cdn.example.com/song.mp3"}')).toBe('https://cdn.example.com/song.mp3')
  })

  it('rejects non-http URLs', () => {
    expect(parseMetingUrl('{"url":"file:///tmp/song.mp3"}')).toBeNull()
  })
})

describe('searchNetEase', () => {
  it('calls NetEase search API and returns songs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        songs: [{
          id: 1,
          name: '晴天',
          artists: [{ name: '周杰伦' }],
          album: { name: '叶惠美' },
          duration: 269000
        }]
      }
    }))))

    await expect(searchNetEase(baseConfig, '晴天', 5, logger)).resolves.toEqual([{
      id: 1,
      name: '晴天',
      artists: '周杰伦',
      albumName: '叶惠美',
      duration: 269000
    }])
  })
})

describe('resolveSongSource', () => {
  it('uses custom Meting API when sourceMode is custom', async () => {
    const fetchMock = vi.fn(async () => new Response('{"url":"https://cdn.example.com/song.mp3"}'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveSongSource({
      ...baseConfig,
      sourceMode: 'custom',
      customMetingApi: 'https://music.example.com/meting'
    }, 123, logger)).resolves.toBe('https://cdn.example.com/song.mp3')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(String((fetchMock.mock.calls as any)[0][0])).toBe('https://music.example.com/meting?type=url&id=123')
  })
})

describe('fetchSongBuffer', () => {
  it('downloads audio content into a Buffer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'audio/mpeg' }
    })))

    await expect(fetchSongBuffer('https://cdn.example.com/song.mp3')).resolves.toEqual(Buffer.from([1, 2, 3]))
  })
})
