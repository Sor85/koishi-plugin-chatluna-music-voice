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
  allowAISendMode: true,
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
  const shape = tool.schema.shape as Record<string, { description?: string }>
  return [
    tool.description,
    shape.query.description,
    shape.index.description,
    shape.sendMode?.description
  ].join('\n')
}

function getSendModeDescription(tool: ChatLunaMusicTool) {
  const sendMode = (tool.schema.shape as Record<string, { description?: string }>).sendMode
  expect(sendMode).toBeDefined()
  return sendMode.description
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

  it('does not expose or mention sendMode by default and ignores hardcoded sendMode input', async () => {
    const session = { userId: '10001' } as Session
    const play = vi.fn(async () => '已发送：晴天 - 周杰伦')
    const tool = new ChatLunaMusicTool({
      ...config,
      allowAISendMode: false
    }, logger, play)

    expect(tool.schema.shape).not.toHaveProperty('sendMode')
    expect(tool.description).toContain('搜索已启用的音乐平台')
    expect(tool.schema.shape.query.description).toContain('歌曲名、歌手名、风格或自然语言音乐搜索词')
    expect(tool.schema.shape.index.description).toContain('上一轮不带链接的候选列表中的歌曲序号')
    expect(tool.description).not.toContain('sendMode')
    expect(tool.description).not.toContain('临时切换发送方式')
    expect(tool.description).not.toContain('默认发送方式')

    await expect(
      tool._call({ query: '晴天', index: 2, sendMode: 'file' }, undefined, {
        configurable: { session }
      })
    ).resolves.toBe('已发送：晴天 - 周杰伦')

    expect(play).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ sendMode: 'audio-url' }),
      '晴天',
      logger,
      2,
      undefined
    )
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

    const parsed = tool.schema.parse({
      query: '晴天'
    }) as { sendMode?: string }

    expect(parsed.sendMode).toBe('default')
    expect(() => tool.schema.parse({
      query: '晴天',
      sendMode: 'default'
    })).not.toThrow()
  })

  it('tells the model not to call index after audio-url-model links are returned', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(tool.description).toContain('不要再次传 index 调用工具')
    expect(tool.schema.shape.index.description).toContain('audio-url-model 结果已包含可用链接')
    expect(getSendModeDescription(tool)).toContain('不要再次传 index 调用工具')
  })

  it('tells the model to use default sendMode unless the user explicitly asks', () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    expect(tool.description).toContain('sendMode 设为 default')
    expect(getSendModeDescription(tool)).toContain('sendMode 设为 default')
    expect(getSendModeDescription(tool)).toContain('当前 default = audio-url')
  })

  it('tells the model what default sendMode currently resolves to', () => {
    const tool = new ChatLunaMusicTool({
      ...config,
      sendMode: 'audio-url-model'
    }, logger, vi.fn())

    expect(tool.description).toContain('default = audio-url-model')
    expect(tool.description).toContain('不要再次传 index 调用工具')
    expect(getSendModeDescription(tool)).toContain('default = audio-url-model')
    expect(getSendModeDescription(tool)).toContain('不要再次传 index 调用工具')
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

  it('does not append sendMode guidance when AI sendMode parameter is disabled', () => {
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
      allowAISendMode: false
    }, logger)

    expect(registerTool).toHaveBeenCalledWith(
      'music_voice',
      expect.objectContaining({
        description: expect.not.stringContaining('sendMode')
      })
    )
    expect(registerTool).toHaveBeenCalledWith(
      'music_voice',
      expect.objectContaining({
        description: expect.not.stringContaining('临时切换发送方式')
      })
    )
  })

  it('removes old sendMode default guidance when AI sendMode parameter is disabled', () => {
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
      allowAISendMode: false,
      toolDescription: '用于搜索音乐；没有要求切换发送方式时，sendMode 请传 default。'
    }, logger)

    const [[, options]] = registerTool.mock.calls as unknown as Array<[string, { description: string }]>
    const description = options.description

    expect(description).toContain('用于搜索音乐')
    expect(description).not.toContain('不要传 sendMode 参数')
    expect(description).not.toContain('sendMode 请传 default')
    expect(description).not.toContain('默认发送方式')
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
