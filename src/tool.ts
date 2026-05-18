// ChatLuna 工具注册模块
// 把网易云音乐播放能力暴露给 ChatLuna 工具调用系统

import type {} from 'koishi-plugin-chatluna/services/chat'

import type { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager'
import { StructuredTool, type ToolRunnableConfig } from '@langchain/core/tools'
import type { Context, Session } from 'koishi'
import { z } from 'zod/v3'

import { DEFAULT_TOOL_NAME } from './constants'
import { playNeteaseMusic } from './player'
import type { Config, MusicToolInput, PluginLogger } from './types'

const musicToolSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Song name, artist name, style, or natural language music search query.')
})

/** 搜索并发送网易云音乐的实际执行函数签名。 */
export type PlayMusicFunction = (
  session: Session,
  config: Config,
  query: string,
  logger: PluginLogger
) => Promise<string>

/** ChatLuna 网易云音乐语音工具，通过 query 搜索网易云音乐并在当前聊天发送整首音频/语音。 */
export class ChatLunaMusicTool extends StructuredTool<
  typeof musicToolSchema,
  MusicToolInput,
  MusicToolInput,
  string
> {
  name: string
  description =
    'Search NetEase Music with a query and send the selected full song as an audio or voice message in the current chat. Use this when the conversation naturally calls for playing music. The only input is query.'
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

    return await this.playMusic(session, this.config, input.query, this.logger)
  }
}

/** 注册 ChatLuna 音乐工具并返回注销函数。 */
export function registerChatLunaMusicTool(
  ctx: Context,
  config: Config,
  logger: PluginLogger
) {
  const toolName = config.toolName.trim() || DEFAULT_TOOL_NAME
  const dispose = ctx.chatluna.platform.registerTool(toolName, {
    createTool() {
      return new ChatLunaMusicTool({ ...config, toolName }, logger)
    },
    selector() {
      return true
    }
  })

  ctx.on('dispose', dispose)
  logger.info('已注册 ChatLuna 音乐工具', toolName)
  return dispose
}
