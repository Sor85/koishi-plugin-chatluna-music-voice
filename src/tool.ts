// ChatLuna 工具注册模块
// 把网易云音乐播放能力暴露给 ChatLuna 工具调用系统

import type {} from 'koishi-plugin-chatluna/services/chat'

import type { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager'
import { StructuredTool, type ToolRunnableConfig } from '@langchain/core/tools'
import type { Context, Session } from 'koishi'
import { z } from 'zod/v3'

import { DEFAULT_TOOL_NAME } from './constants'
import { playNeteaseMusic } from './player'
import type { Config, MusicToolInput, MusicToolResult, PluginLogger, SendMode } from './types'

const TOOL_REGISTRATION_DESCRIPTION =
  '用于搜索网易云音乐或 QQ 音乐并在当前聊天中发送整首歌曲音频、语音或音乐卡片；没有要求切换发送方式时，sendMode 请传 default；default 表示使用 Koishi 前端中用户选择的默认发送方式；audio-url-model 模式返回链接后不要再次传 index 调用工具。'

const TOOL_REGISTRATION_META = {
  source: 'extension',
  group: 'music',
  tags: ['music', 'netease', 'qqmusic', 'voice'],
  defaultAvailability: {
    enabled: true,
    main: true,
    chatluna: true,
    characterScope: 'all'
  }
}

function getAudioUrlModelToolNote(defaultSendMode: SendMode) {
  return defaultSendMode === 'audio-url-model'
    ? '因为 default = audio-url-model，候选结果会返回可直接选择的远程音频链接；拿到这些链接后不要再次传 index 调用工具。'
    : '在 audio-url-model 模式下，候选结果会返回可直接选择的远程音频链接；拿到这些链接后不要再次传 index 调用工具。'
}

function getAudioUrlModelRegistrationNote(defaultSendMode: SendMode) {
  return defaultSendMode === 'audio-url-model'
    ? '因为 default = audio-url-model，候选结果会返回可直接选择的远程音频链接；拿到这些链接后不要再次传 index 调用工具。'
    : '只有显式使用 audio-url-model 时，返回链接后才不要再次传 index 调用工具。'
}

function getToolDescription(defaultSendMode: SendMode) {
  return `搜索已启用的音乐平台。没有明确要求切换发送方式时，请将 sendMode 设为 default。当前 Koishi 前端默认发送方式：default = ${defaultSendMode}。普通发送模式下，如果工具返回不带链接的编号候选列表，请用相同 query 和用户选择的 index 再次调用工具，以在当前聊天发送整首歌曲音频、语音或音乐卡片。${getAudioUrlModelToolNote(defaultSendMode)}输入参数为 query，以及可选 index。`
}

function getRegistrationDescription(config: Config) {
  const baseDescription = config.toolDescription.trim() || TOOL_REGISTRATION_DESCRIPTION
  return `${baseDescription} 当前 Koishi 前端默认发送方式：default = ${config.sendMode}。${getAudioUrlModelRegistrationNote(config.sendMode)}`
}

function createMusicToolSchema(defaultSendMode: SendMode) {
  return z.object({
    query: z
      .string()
      .min(1)
      .describe('歌曲名、歌手名、风格或自然语言音乐搜索词。'),
    index: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('上一轮不带链接的候选列表中的歌曲序号，从 1 开始。audio-url-model 结果已包含可用链接，不要为这种结果传 index。'),
    sendMode: z
      .enum(['default', 'audio-buffer', 'audio-url-model', 'audio-url', 'file', 'music-card'])
      .default('default')
      .describe(`本次调用的歌曲发送方式。没有明确要求切换发送方式时，请将 sendMode 设为 default。当前 Koishi 前端默认发送方式：default = ${defaultSendMode}。audio-buffer 会下载音频后发送语音，audio-url-model 会把远程音频链接返回给模型；拿到这些链接后不要再次传 index 调用工具。audio-url 会发送远程音频 URL 文本，file 会把远程音频 URL 作为文件发送，music-card 会按歌曲来源发送音乐卡片。`)
  })
}

const musicToolSchema = createMusicToolSchema('audio-buffer')

/** 搜索并发送网易云音乐的实际执行函数签名。 */
export type PlayMusicFunction = (
  session: Session,
  config: Config,
  query: string,
  logger: PluginLogger,
  index?: number,
  sendMode?: MusicToolInput['sendMode']
) => Promise<MusicToolResult>

/** ChatLuna 网易云音乐语音工具，通过 query 搜索网易云音乐并在当前聊天发送整首音频/语音。 */
export class ChatLunaMusicTool extends StructuredTool<
  typeof musicToolSchema,
  MusicToolInput,
  MusicToolInput,
  MusicToolResult
> {
  name: string
  description = getToolDescription('audio-buffer')
  schema = musicToolSchema

  constructor(
    private config: Config,
    private logger: PluginLogger,
    private playMusic: PlayMusicFunction = playNeteaseMusic
  ) {
    super()
    this.name = config.toolName.trim() || DEFAULT_TOOL_NAME
    this.description = getToolDescription(config.sendMode)
    this.schema = createMusicToolSchema(config.sendMode)
  }

  async _call(
    input: MusicToolInput,
    _runManager?: CallbackManagerForToolRun,
    runConfig?: ToolRunnableConfig
  ) {
    const session = runConfig?.configurable?.session as Session | undefined

    if (!session) {
      return '音乐工具无法获取当前会话。'
    }

    return await this.playMusic(
      session,
      this.config,
      input.query,
      this.logger,
      input.index,
      input.sendMode
    )
  }
}

/** 注册 ChatLuna 音乐工具并返回注销函数。 */
export function registerChatLunaMusicTool(
  ctx: Context,
  config: Config,
  logger: PluginLogger
) {
  const toolName = config.toolName.trim() || DEFAULT_TOOL_NAME
  const toolDescription = getRegistrationDescription(config)
  const dispose = ctx.chatluna.platform.registerTool(toolName, {
    description: toolDescription,
    createTool() {
      return new ChatLunaMusicTool({ ...config, toolName }, logger)
    },
    selector() {
      return true
    },
    meta: TOOL_REGISTRATION_META
  })

  ctx.on('dispose', dispose)
  logger.info('已注册 ChatLuna 音乐工具', toolName)
  return dispose
}
