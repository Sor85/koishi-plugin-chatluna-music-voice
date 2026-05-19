// 音乐播放主流程测试
// 验证搜索、候选歌单、选歌、解析直链和发送的编排结果

import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  toolDescription: '自定义音乐工具描述。',
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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('sends selected song by 1-based index as direct tool output when searchLimit > 1', async () => {
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      resolveSource: vi.fn(async (_cfg: Config, id: number) =>
        id === anotherSong.id ? 'https://cdn.example.com/live.mp3' : ''
      ),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 2, deps))
      .resolves.toEqual({
        lc_direct_tool_output: true,
        replyEmitted: true
      })

    expect(deps.resolveSource).toHaveBeenCalledWith(config, 2, logger)
    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/live.mp3', config)
    expect(logger.info).toHaveBeenCalledWith('已发送歌曲', '晴天 Live - 周杰伦')
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

  it('sends NetEase card without resolving audio source in netease-card mode', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => { throw new Error('should not resolve source') }),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(
      playNeteaseMusic(session, singleConfig, '晴天', logger, undefined, deps, 'netease-card')
    ).resolves.toBe('已发送：晴天 - 周杰伦')

    expect(deps.resolveSource).not.toHaveBeenCalled()
    expect(deps.send).toHaveBeenCalledWith(
      session,
      '186016',
      { ...singleConfig, sendMode: 'netease-card' }
    )
  })

  it('returns remote audio URL to model without sending in audio-url-model mode', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(
      playNeteaseMusic(session, singleConfig, '晴天', logger, undefined, deps, 'audio-url-model')
    ).resolves.toBe('远程音频链接：https://cdn.example.com/song.mp3')

    expect(deps.resolveSource).toHaveBeenCalledWith(singleConfig, 186016, logger)
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns candidate list with remote audio URLs in audio-url-model mode', async () => {
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      resolveSource: vi.fn(async (_cfg: Config, id: number) =>
        id === anotherSong.id
          ? 'https://cdn.example.com/live.mp3'
          : 'https://cdn.example.com/song.mp3'
      ),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(
      playNeteaseMusic(session, config, '晴天', logger, undefined, deps, 'audio-url-model')
    ).resolves.toBe(
      '找到以下候选歌曲：\n'
      + '1. 晴天 - 周杰伦（叶惠美）\n'
      + '链接：https://cdn.example.com/song.mp3\n'
      + '2. 晴天 Live - 周杰伦（演唱会）\n'
      + '链接：https://cdn.example.com/live.mp3\n\n'
      + '请直接从以上链接中选择，不要再次调用本工具传入 index。'
    )

    expect(deps.resolveSource).toHaveBeenCalledWith(config, 186016, logger)
    expect(deps.resolveSource).toHaveBeenCalledWith(config, 2, logger)
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('keeps candidates when one remote audio URL fails in audio-url-model mode', async () => {
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      resolveSource: vi.fn(async (_cfg: Config, id: number) => {
        if (id === song.id) throw new Error('source failed')
        return 'https://cdn.example.com/live.mp3'
      }),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(
      playNeteaseMusic(session, config, '晴天', logger, undefined, deps, 'audio-url-model')
    ).resolves.toBe(
      '找到以下候选歌曲：\n'
      + '1. 晴天 - 周杰伦（叶惠美）\n'
      + '链接：获取失败\n'
      + '2. 晴天 Live - 周杰伦（演唱会）\n'
      + '链接：https://cdn.example.com/live.mp3\n\n'
      + '请直接从以上链接中选择，不要再次调用本工具传入 index。'
    )

    expect(logger.warn).toHaveBeenCalledWith('歌曲直链获取失败', expect.any(Error))
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns selected remote audio URL by index in audio-url-model mode', async () => {
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/live.mp3'),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(
      playNeteaseMusic(session, config, '晴天', logger, 2, deps, 'audio-url-model')
    ).resolves.toBe('远程音频链接：https://cdn.example.com/live.mp3')

    expect(deps.resolveSource).toHaveBeenCalledWith(config, 2, logger)
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('sends selected NetEase card as direct tool output when searchLimit > 1', async () => {
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      resolveSource: vi.fn(async () => { throw new Error('should not resolve source') }),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(
      playNeteaseMusic(session, config, '晴天', logger, 1, deps, 'netease-card')
    ).resolves.toEqual({
      lc_direct_tool_output: true,
      replyEmitted: true
    })

    expect(deps.resolveSource).not.toHaveBeenCalled()
    expect(deps.send).toHaveBeenCalledWith(
      session,
      '186016',
      { ...config, sendMode: 'netease-card' }
    )
    expect(logger.info).toHaveBeenCalledWith('已发送歌曲', '晴天 - 周杰伦')
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

  it('returns source failure text when searchLimit > 1', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => { throw new Error('source failed') }),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 1, deps))
      .resolves.toBe('找到了歌曲，但暂时无法获取播放地址。')

    expect(logger.warn).toHaveBeenCalledWith('歌曲直链获取失败', expect.any(Error))
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

  it('returns send failure text when searchLimit > 1', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      send: vi.fn(async () => { throw new Error('send failed') })
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 1, deps))
      .resolves.toBe('找到了歌曲，但语音发送失败。')

    expect(logger.error).toHaveBeenCalledWith('歌曲语音发送失败', expect.any(Error))
  })

  it('returns NetEase card send failure text when searchLimit > 1', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      resolveSource: vi.fn(async () => { throw new Error('should not resolve source') }),
      send: vi.fn(async () => { throw new Error('send failed') })
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 1, deps, 'netease-card'))
      .resolves.toBe('找到了歌曲，但语音发送失败。')

    expect(deps.resolveSource).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith('歌曲语音发送失败', expect.any(Error))
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
