// ChatLuna 音乐语音工具插件入口
// 负责导出 Koishi 插件元信息和 apply 函数

import type { Context } from 'koishi'
import { Schema } from 'koishi'

export const name = 'chatluna-music'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

/** 注册 ChatLuna 音乐工具。 */
export function apply(_ctx: Context, _config: Config) {}
