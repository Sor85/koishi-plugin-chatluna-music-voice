// ChatLuna 音乐语音工具插件入口
// 负责声明 Koishi 插件依赖并注册 ChatLuna 工具

import type {} from 'koishi-plugin-chatluna/services/chat'

import type { Context } from 'koishi'

import { Config } from './config'
import { createPluginLogger } from './logger'
import { registerAudioUrlRedirector } from './short-link'
import { registerChatLunaMusicTool } from './tool'
import type { Config as PluginConfig } from './types'

export const name = 'chatluna-music'

export const inject = {
  required: ['chatluna'],
  optional: ['server']
}

export { Config }

/** 注册 ChatLuna 音乐工具。 */
export function apply(ctx: Context, config: PluginConfig) {
  const logger = createPluginLogger(ctx, config)
  const audioUrlRedirector = registerAudioUrlRedirector(ctx, config, logger)
  registerChatLunaMusicTool(ctx, config, logger, audioUrlRedirector)
}
