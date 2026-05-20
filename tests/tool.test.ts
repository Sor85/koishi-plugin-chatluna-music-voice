// ChatLuna 工具注册测试
// 验证工具注册、元数据、query 输入、发送方式和当前 session 读取

import type { Context, Session } from 'koishi'
import { describe, expect, it, vi } from 'vitest'

import type { Config, PluginLogger } from '../src/types'
import { ChatLunaMusicTool, registerChatLunaMusicTool } from '../src/tool'

const config: Config = {
  toolName: 'music_voice',
  toolDescription: '自定义音乐工具描述。',
  searchLimit: 5,
  enableNetEaseSearch: true,
  enableQQMusicSearch: false,
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

function getToolPromptText(tool: ChatLunaMusicTool) {
  return [
    tool.description,
    tool.schema.shape.query.description,
    tool.schema.shape.index.description,
    tool.schema.shape.sendMode.description
  ].join('\n')
}

describe('ChatLunaMusicTool', () => {
  it('returns a session error when current session is missing', async () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    await expect(tool._call({ query: '晴天' })).resolves.toBe(
      '音乐工具无法获取当前会话。'
    )
  })

  it('passes query, index, send mode and session to play function', async () => {
    const session = { userId: '10001' } as Session
    const play = vi.fn(async () => '已发送：晴天 - 周杰伦')
    const tool = new ChatLunaMusicTool(config, logger, play)

    await expect(
      tool._call({ query: '晴天', index: 2, sendMode: 'file' }, undefined, {
        configurable: { session }
      })
    ).resolves.toBe('已发送：晴天 - 周杰伦')

    expect(play).toHaveBeenCalledWith(session, config, '晴天', logger, 2, 'file')
  })

  it('rejects netease-card as a tool send mode', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(() => tool.schema.parse({
      query: '晴天',
      sendMode: 'netease-card'
    })).toThrow()
  })

  it('accepts music-card as a tool send mode', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(() => tool.schema.parse({
      query: '告白气球',
      sendMode: 'music-card'
    })).not.toThrow()
  })

  it('accepts audio-url-model as a tool send mode', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(() => tool.schema.parse({
      query: '晴天',
      sendMode: 'audio-url-model'
    })).not.toThrow()
  })

  it('accepts default as the tool send mode default value', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(tool.schema.parse({
      query: '晴天'
    }).sendMode).toBe('default')
    expect(() => tool.schema.parse({
      query: '晴天',
      sendMode: 'default'
    })).not.toThrow()
  })

  it('tells the model not to call index after audio-url-model links are returned', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(tool.description).toContain('不要再次传 index 调用工具')
    expect(tool.schema.shape.index.description).toContain('audio-url-model 结果已包含可用链接')
    expect(tool.schema.shape.sendMode.description).toContain('不要再次传 index 调用工具')
  })

  it('tells the model to use default sendMode unless the user explicitly asks', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(tool.description).toContain('sendMode 设为 default')
    expect(tool.schema.shape.sendMode.description).toContain('sendMode 设为 default')
    expect(tool.schema.shape.sendMode.description).toContain('Koishi 前端')
  })

  it('tells the model what default sendMode currently resolves to', () => {
    const tool = new ChatLunaMusicTool({
      ...config,
      sendMode: 'audio-url-model'
    }, logger, vi.fn())

    expect(tool.description).toContain('default = audio-url-model')
    expect(tool.description).toContain('不要再次传 index 调用工具')
    expect(tool.schema.shape.sendMode.description).toContain('default = audio-url-model')
    expect(tool.schema.shape.sendMode.description).toContain('不要再次传 index 调用工具')
  })

  it('uses Chinese text for all tool prompt descriptions', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())
    const promptText = getToolPromptText(tool)

    expect(promptText).toContain('搜索已启用的音乐平台')
    expect(promptText).toContain('歌曲名、歌手名、风格或自然语言音乐搜索词')
    expect(promptText).not.toContain('Search enabled music platforms')
    expect(promptText).not.toContain('Unless the user explicitly asks')
    expect(promptText).not.toContain('Candidate song number')
    expect(promptText).not.toContain('Optional song sending mode')
    expect(promptText).not.toContain('Song name, artist name')
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
        description: expect.stringContaining('自定义音乐工具描述。'),
        meta: {
          source: 'extension',
          group: 'music',
          tags: ['music', 'netease', 'qqmusic', 'voice'],
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

  it('appends current default sendMode to custom registration description', () => {
    const dispose = vi.fn()
    const registerTool = vi.fn(() => dispose)
    const on = vi.fn()
    const ctx = {
      chatluna: {
        platform: { registerTool }
      },
      on
    } as unknown as Context

    registerChatLunaMusicTool(ctx, {
      ...config,
      sendMode: 'audio-url-model'
    }, logger)

    expect(registerTool).toHaveBeenCalledWith(
      'music_voice',
      expect.objectContaining({
        description: expect.stringContaining('default = audio-url-model')
      })
    )
    expect(registerTool).toHaveBeenCalledWith(
      'music_voice',
      expect.objectContaining({
        description: expect.stringContaining('不要再次传 index')
      })
    )
  })

  it('falls back to default description when configured description is blank', () => {
    const dispose = vi.fn()
    const registerTool = vi.fn(() => dispose)
    const on = vi.fn()
    const ctx = {
      chatluna: {
        platform: { registerTool }
      },
      on
    } as unknown as Context
    const blankDescriptionConfig = {
      ...config,
      toolDescription: '   '
    }

    registerChatLunaMusicTool(ctx, blankDescriptionConfig, logger)

    expect(registerTool).toHaveBeenCalledWith(
      'music_voice',
      expect.objectContaining({
        description: expect.stringContaining('用于搜索网易云音乐或 QQ 音乐并在当前聊天中发送整首歌曲音频、语音或音乐卡片')
      })
    )
    expect(registerTool).toHaveBeenCalledWith(
      'music_voice',
      expect.objectContaining({
        description: expect.stringContaining('default = audio-url')
      })
    )
  })
})
