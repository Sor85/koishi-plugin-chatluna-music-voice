// ChatLuna 工具注册模块
// 把网易云音乐播放能力暴露给 ChatLuna 工具调用系统

import type {} from 'koishi-plugin-chatluna/services/chat'

import type { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager'
import { StructuredTool, type ToolRunnableConfig } from '@langchain/core/tools'
import type { Context, Session } from 'koishi'
import { z } from 'zod/v3'

import { DEFAULT_TOOL_NAME } from './constants'
import { playNeteaseMusic } from './player'
import type { Config, MusicToolInput, MusicToolResult, PluginLogger } from './types'

const TOOL_REGISTRATION_DESCRIPTION =
  '用于搜索网易云音乐并在当前聊天中发送整首歌曲音频或语音。'

const TOOL_REGISTRATION_META = {
  source: 'extension',
  group: 'music',
  tags: ['music', 'netease', 'voice'],
  defaultAvailability: {
    enabled: true,
    main: true,
    chatluna: true,
    characterScope: 'all'
  }
}

const musicToolSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Song name, artist name, style, or natural language music search query.'),
  index: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Candidate song number from the previous result list, starting from 1.'),
  sendMode: z
    .enum(['audio-buffer', 'audio-url', 'file', 'netease-card'])
    .optional()
    .describe('Optional song sending mode for this call. audio-buffer sends voice after downloading audio, audio-url sends the remote audio URL as text, file sends the remote audio URL as a file, and netease-card sends a NetEase Music card. Omit it to use the default mode configured in Koishi.')
})

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
  description =
    'Search NetEase Music with a query. If the tool returns a numbered candidate list, call it again with the same query and the chosen index to send that full song as audio or voice in the current chat. Input is query and optional index.'
  schema = musicToolSchema

  constructor(
    private config: Config,
    private logger: PluginLogger,
    private playMusic: PlayMusicFunction = playNeteaseMusic
  ) {
    super()
    this.name = config.toolName.trim() || DEFAULT_TOOL_NAME
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
  const toolDescription = config.toolDescription.trim() || TOOL_REGISTRATION_DESCRIPTION
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
