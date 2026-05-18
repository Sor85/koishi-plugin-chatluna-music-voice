// ChatLuna 工具注册测试
// 验证工具注册、元数据、query 输入和当前 session 读取

import type { Context, Session } from 'koishi'
import { describe, expect, it, vi } from 'vitest'

import type { Config, PluginLogger } from '../src/types'
import { ChatLunaMusicTool, registerChatLunaMusicTool } from '../src/tool'

const config: Config = {
  toolName: 'music_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('ChatLunaMusicTool', () => {
  it('returns a session error when current session is missing', async () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    await expect(tool._call({ query: '晴天' })).resolves.toBe(
      '音乐工具无法获取当前会话。'
    )
  })

  it('passes query, index and session to play function', async () => {
    const session = { userId: '10001' } as Session
    const play = vi.fn(async () => '已发送：晴天 - 周杰伦')
    const tool = new ChatLunaMusicTool(config, logger, play)

    await expect(
      tool._call({ query: '晴天', index: 2 }, undefined, {
        configurable: { session }
      })
    ).resolves.toBe('已发送：晴天 - 周杰伦')

    expect(play).toHaveBeenCalledWith(session, config, '晴天', logger, 2)
  })
})

describe('registerChatLunaMusicTool', () => {
  it('registers a ChatLuna platform tool and returns dispose function', () => {
    const dispose = vi.fn()
    const registerTool = vi.fn(() => dispose)
    const on = vi.fn()
    const ctx = {
      chatluna: {
        platform: { registerTool }
      },
      on
    } as unknown as Context

    const result = registerChatLunaMusicTool(ctx, config, logger)

    expect(result).toBe(dispose)
    expect(registerTool).toHaveBeenCalledWith(
      'music_voice',
      expect.objectContaining({
        description: '用于搜索网易云音乐并在当前聊天中发送整首歌曲音频或语音。',
        meta: {
          source: 'extension',
          group: 'music',
          tags: ['music', 'netease', 'voice'],
          defaultAvailability: {
            enabled: true,
            main: true,
            chatluna: true,
            characterScope: 'all'
          }
        },
        createTool: expect.any(Function),
        selector: expect.any(Function)
      })
    )
    expect(on).toHaveBeenCalledWith('dispose', dispose)
  })
})
