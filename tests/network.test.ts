// 网络模块测试
// 验证网易云搜索解析、Meting URL 解析和下载能力

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Config, PluginLogger } from '../src/types'
import {
  fetchSongBuffer,
  parseMetingUrl,
  parseQQMusicSearchResponse,
  parseSearchResponse,
  resolveSongSource,
  searchMusic,
  searchQQMusic,
  searchNetEase
} from '../src/network'

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const baseConfig: Config = {
  toolName: 'music_voice',
  toolDescription: '自定义音乐工具描述。',
  searchLimit: 5,
  enableNetEaseSearch: true,
  enableQQMusicSearch: false,
  allowAISendMode: true,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
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

  it('skips bad items and keeps good ones', () => {
    const result = parseSearchResponse(JSON.stringify({
      result: {
        songs: [
          { id: 1, name: '坏歌', duration: 100 },
          { id: 2, name: '好歌', artists: [{ name: '歌手' }], album: { name: '专辑' }, duration: 200 }
        ]
      }
    }))

    expect(result).toEqual([{
      id: 2,
      name: '好歌',
      artists: '歌手',
      albumName: '专辑',
      duration: 200
    }])
  })

  it('returns empty array when all items are invalid', () => {
    const result = parseSearchResponse(JSON.stringify({
      result: { songs: [{ id: 1 }] }
    }))

    expect(result).toEqual([])
  })

  it('returns empty array for empty songs list', () => {
    const result = parseSearchResponse(JSON.stringify({
      result: { songs: [] }
    }))

    expect(result).toEqual([])
  })
})

describe('parseQQMusicSearchResponse', () => {
  it('converts QQ Music songs to SongData', () => {
    const result = parseQQMusicSearchResponse(JSON.stringify({
      code: 0,
      data: {
        song: {
          list: [{
            songid: 107192078,
            songmid: '003OUlho2HcRHC',
            media_mid: '003gbY6c0g1L4Q',
            songname: '告白气球',
            singer: [{ name: '周杰伦' }],
            albumname: '周杰伦的床边故事',
            interval: 215
          }]
        }
      }
    }))

    expect(result).toEqual([{
      platform: 'qq',
      id: 107192078,
      sourceId: '003OUlho2HcRHC',
      cardId: '107192078',
      name: '告白气球',
      artists: '周杰伦',
      albumName: '周杰伦的床边故事',
      duration: 215000
    }])
  })

  it('returns null for invalid QQ Music JSON', () => {
    expect(parseQQMusicSearchResponse('not json')).toBeNull()
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

  it('resolves empty array when search returns empty songs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: { songs: [] }
    }))))

    await expect(searchNetEase(baseConfig, '不存在的歌', 5, logger)).resolves.toEqual([])
  })

  it('falls back to proxy when direct search returns unusable content', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('web-proxy.apifox.cn')) {
        return new Response(JSON.stringify({
          result: {
            songs: [{
              id: 1,
              name: '字母歌',
              artists: [{ name: '贝乐虎儿歌' }],
              album: { name: '贝乐虎儿歌' },
              duration: 104565
            }]
          }
        }))
      }

      return new Response('not json')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(searchNetEase(baseConfig, '字母歌', 5, logger)).resolves.toEqual([{
      id: 1,
      name: '字母歌',
      artists: '贝乐虎儿歌',
      albumName: '贝乐虎儿歌',
      duration: 104565
    }])
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('web-proxy.apifox.cn'))).toBe(true)
  })
})

describe('searchQQMusic', () => {
  it('calls QQ Music search API and returns songs', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({
      code: 0,
      data: {
        song: {
          list: [{
            songid: 107192078,
            songmid: '003OUlho2HcRHC',
            songname: '告白气球',
            singer: [{ name: '周杰伦' }],
            albumname: '周杰伦的床边故事',
            interval: 215
          }]
        }
      }
    })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(searchQQMusic(baseConfig, '告白气球', 5, logger)).resolves.toEqual([{
      platform: 'qq',
      id: 107192078,
      sourceId: '003OUlho2HcRHC',
      cardId: '107192078',
      name: '告白气球',
      artists: '周杰伦',
      albumName: '周杰伦的床边故事',
      duration: 215000
    }])
    expect(String(fetchMock.mock.calls[0][0])).toContain('n=5')
  })
})

describe('searchMusic', () => {
  it('searches every enabled platform with the per-platform limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      const href = String(url)

      if (href.includes('c.y.qq.com')) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            song: {
              list: [{
                songid: 107192078,
                songmid: '003OUlho2HcRHC',
                songname: '告白气球',
                singer: [{ name: '周杰伦' }],
                albumname: '周杰伦的床边故事',
                interval: 215
              }]
            }
          }
        }))
      }

      return new Response(JSON.stringify({
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
    }))

    await expect(searchMusic({
      ...baseConfig,
      enableQQMusicSearch: true
    }, '周杰伦', 5, logger)).resolves.toEqual([
      {
        id: 186016,
        name: '晴天',
        artists: '周杰伦',
        albumName: '叶惠美',
        duration: 269000
      },
      {
        platform: 'qq',
        id: 107192078,
        sourceId: '003OUlho2HcRHC',
        cardId: '107192078',
        name: '告白气球',
        artists: '周杰伦',
        albumName: '周杰伦的床边故事',
        duration: 215000
      }
    ])
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

    const expectedUrl = 'https://music.example.com/meting?type=url&id=123'
    expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }))
  })

  it('overwrites existing query and strips hash from custom URL', async () => {
    const fetchMock = vi.fn(async () => new Response('{"url":"https://cdn.example.com/song.mp3"}'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveSongSource({
      ...baseConfig,
      sourceMode: 'custom',
      customMetingApi: 'https://music.example.com/meting?foo=bar&type=old#frag'
    }, 123, logger)).resolves.toBe('https://cdn.example.com/song.mp3')

    const expectedUrl = 'https://music.example.com/meting?foo=bar&type=url&id=123'
    expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }))
  })

  it('accepts a direct media response from Meting API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'audio/mpeg' }
    })))

    await expect(resolveSongSource({
      ...baseConfig,
      sourceMode: 'custom',
      customMetingApi: 'https://music.example.com/meting'
    }, 123, logger)).resolves.toBe('https://music.example.com/meting?type=url&id=123')
  })

  it('adds Tencent server parameter when resolving a QQ Music song', async () => {
    const fetchMock = vi.fn(async () => new Response('{"url":"https://cdn.example.com/qq.m4a"}'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveSongSource({
      ...baseConfig,
      sourceMode: 'custom',
      customMetingApi: 'https://music.example.com/meting'
    }, {
      platform: 'qq',
      id: 107192078,
      sourceId: '003OUlho2HcRHC',
      cardId: '107192078',
      name: '告白气球',
      artists: '周杰伦',
      albumName: '周杰伦的床边故事',
      duration: 215000
    }, logger)).resolves.toBe('https://cdn.example.com/qq.m4a')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://music.example.com/meting?type=url&id=003OUlho2HcRHC&server=tencent',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
    )
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
