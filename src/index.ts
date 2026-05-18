// ChatLuna 音乐语音工具插件入口
// 负责声明 Koishi 插件依赖并注册 ChatLuna 工具

import type { Context } from 'koishi'

import { Config } from './config'
import type { Config as PluginConfig } from './types'

export const name = 'chatluna-music'

export const inject = {
  required: ['chatluna']
}

export { Config }

/** 注册 ChatLuna 音乐工具。 */
export function apply(_ctx: Context, _config: PluginConfig) {}
