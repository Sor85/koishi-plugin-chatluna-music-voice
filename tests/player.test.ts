// 音乐播放主流程测试
// 验证搜索、候选歌单、选歌、解析直链和发送的编排结果

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
  toolName: 'music_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  debug: false
}

const singleConfig: Config = { ...config, searchLimit: 1 }

const session = { bot: {}, send: vi.fn() } as unknown as Parameters<typeof playNeteaseMusic>[0]

const song: SongData = {
  id: 186016,
  name: '晴天',
  artists: '周杰伦',
  albumName: '叶惠美',
  duration: 269000
}

const anotherSong: SongData = {
  id: 2,
  name: '晴天 Live',
  artists: '周杰伦',
  albumName: '演唱会',
  duration: 300000
}

describe('playNeteaseMusic', () => {
  it('sends the only candidate directly when searchLimit is 1', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, singleConfig, '晴天', logger, undefined, deps))
      .resolves.toBe('已发送：晴天 - 周杰伦')

    expect(deps.search).toHaveBeenCalledWith(singleConfig, '晴天', 1, logger)
    expect(deps.resolveSource).toHaveBeenCalledWith(singleConfig, 186016, logger)
    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/song.mp3', singleConfig)
  })

  it('returns candidate list when searchLimit > 1 and no index', async () => {
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, undefined, deps))
      .resolves.toBe(
        '找到以下候选歌曲：\n'
        + '1. 晴天 - 周杰伦（叶惠美）\n'
        + '2. 晴天 Live - 周杰伦（演唱会）\n\n'
        + '请根据用户想听的歌曲，再次调用本工具并传入对应 index。'
      )
    expect(deps.resolveSource).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('sends selected song by 1-based index when searchLimit > 1', async () => {
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      resolveSource: vi.fn(async (_cfg: Config, id: number) =>
        id === anotherSong.id ? 'https://cdn.example.com/live.mp3' : ''
      ),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 2, deps))
      .resolves.toBe('已发送：晴天 Live - 周杰伦')

    expect(deps.resolveSource).toHaveBeenCalledWith(config, 2, logger)
    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/live.mp3', config)
  })

  it('uses requested send mode for current tool call without changing default config', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(
      playNeteaseMusic(session, singleConfig, '晴天', logger, undefined, deps, 'file')
    ).resolves.toBe('已发送：晴天 - 周杰伦')

    expect(deps.send).toHaveBeenCalledWith(
      session,
      'https://cdn.example.com/song.mp3',
      { ...singleConfig, sendMode: 'file' }
    )
    expect(singleConfig.sendMode).toBe('audio-url')
  })

  it('returns range error when index is out of bounds', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => ''),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 2, deps))
      .resolves.toBe('序号无效，请选择 1-1 之间的数字。')
    expect(deps.resolveSource).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns not found when search has no result', async () => {
    const deps = {
      search: vi.fn(async () => []),
      resolveSource: vi.fn(async () => ''),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '不存在的歌', logger, undefined, deps))
      .resolves.toBe('没有找到合适歌曲。')

    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns not found when query is empty', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => ''),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '   ', logger, undefined, deps))
      .resolves.toBe('没有找到合适歌曲。')

    expect(deps.search).not.toHaveBeenCalled()
  })

  it('returns source failure text when URL resolving fails', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => { throw new Error('source failed') }),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, singleConfig, '晴天', logger, undefined, deps))
      .resolves.toBe('找到了歌曲，但暂时无法获取播放地址。')

    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns send failure text when message sending fails', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      send: vi.fn(async () => { throw new Error('send failed') })
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, singleConfig, '晴天', logger, undefined, deps))
      .resolves.toBe('找到了歌曲，但语音发送失败。')
  })

  it('returns service unavailable when search throws', async () => {
    const deps = {
      search: vi.fn(async () => { throw new Error('network failed') }),
      resolveSource: vi.fn(async () => ''),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, undefined, deps))
      .resolves.toBe('音乐服务暂时不可用。')
  })

})
