// Koishi 控制台配置 Schema
// 定义 ChatLuna 音乐语音工具的可配置项

import { Schema } from 'koishi'

import { DEFAULT_TOOL_NAME } from './constants'
import type { Config as PluginConfig } from './types'

export const Config: Schema<PluginConfig> = Schema.intersect([
  Schema.object({
    toolName: Schema.string()
      .description('注册到 ChatLuna 的工具名称')
      .default(DEFAULT_TOOL_NAME),
    searchLimit: Schema.natural()
      .min(1)
      .max(10)
      .step(1)
      .description('每次搜索返回的候选歌曲数量')
      .default(5),
    generationTip: Schema.string()
      .description('发送歌曲前额外发送的提示文字，留空则不发送提示')
      .default('')
  }).description('基础设置'),

  Schema.object({
    sourceMode: Schema.union([
      Schema.const('preset').description('使用预设 Meting API 列表'),
      Schema.const('custom').description('使用自定义 Meting API')
    ])
      .role('radio')
      .description('歌曲直链 API 来源')
      .default('preset'),
    customMetingApi: Schema.string()
      .role('link')
      .description('自定义 Meting API 地址，仅在选择自定义来源时使用')
      .default('https://api.injahow.cn/meting/')
  }).description('请求设置'),

  Schema.object({
    sendMode: Schema.union([
      Schema.const('audio-buffer').description('下载音频后发送语音'),
      Schema.const('audio-url').description('直接发送远程音频链接'),
      Schema.const('file').description('把远程音频链接作为文件发送')
    ])
      .role('radio')
      .description('默认歌曲发送方式，AI 调用工具时可临时选择其他发送方式')
      .default('audio-buffer')
  }).description('发送设置'),

  Schema.object({
    debug: Schema.boolean()
      .description('输出详细调试日志')
      .default(false)
  }).description('开发者选项')
])
