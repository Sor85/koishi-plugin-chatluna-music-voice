// 音乐播放主流程测试
// 验证搜索、选歌、解析直链和发送的编排结果

import { describe, expect, it, vi } from 'vitest'

import type { PlayNeteaseMusicDependencies } from '../src/player'
import type { Config, PluginLogger, SongData } from '../src/types'
import { playNeteaseMusic } from '../src/player'

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const config: Config = {
  toolName: 'play_netease_music_as_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

const session = { bot: {}, send: vi.fn() } as unknown as Parameters<typeof playNeteaseMusic>[0]

const song: SongData = {
  id: 186016,
  name: '晴天',
  artists: '周杰伦',
  albumName: '叶惠美',
  duration: 269000
}

describe('playNeteaseMusic', () => {
  it('searches, resolves, sends and returns success text', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('已发送：晴天 - 周杰伦')

    expect(deps.search).toHaveBeenCalledWith(config, '晴天', 5, logger)
    expect(deps.resolveSource).toHaveBeenCalledWith(config, 186016, logger)
    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/song.mp3', config)
  })

  it('returns not found when search has no result', async () => {
    const deps = {
      search: vi.fn(async () => []),
      select: vi.fn(() => undefined),
      resolveSource: vi.fn(async () => ''),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '不存在的歌', logger, deps))
      .resolves.toBe('没有找到合适歌曲。')

    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns not found when query is empty', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => ''),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '   ', logger, deps))
      .resolves.toBe('没有找到合适歌曲。')

    expect(deps.search).not.toHaveBeenCalled()
  })

  it('returns not found when select returns undefined', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => undefined),
      resolveSource: vi.fn(async () => ''),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('没有找到合适歌曲。')

    expect(deps.resolveSource).not.toHaveBeenCalled()
  })

  it('returns source failure text when URL resolving fails', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => { throw new Error('source failed') }),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('找到了歌曲，但暂时无法获取播放地址。')

    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns send failure text when message sending fails', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => { throw new Error('send failed') })
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('找到了歌曲，但语音发送失败。')
  })

  it('returns service unavailable when search throws', async () => {
    const deps = {
      search: vi.fn(async () => { throw new Error('network failed') }),
      select: vi.fn(() => undefined),
      resolveSource: vi.fn(async () => ''),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('音乐服务暂时不可用。')
  })

  it('continues sending when sendTip fails but send succeeds', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => { throw new Error('tip failed') }),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('已发送：晴天 - 周杰伦')

    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/song.mp3', config)
    expect(logger.warn).toHaveBeenCalledWith('生成提示发送失败', expect.any(Error))
  })
})
