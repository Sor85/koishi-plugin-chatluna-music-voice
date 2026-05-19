// Koishi 控制台配置 Schema
// 定义 ChatLuna 音乐语音工具的可配置项

import { Schema } from 'koishi'

import { DEFAULT_TOOL_NAME } from './constants'

export const Config = Schema.intersect([
  Schema.object({
    toolName: Schema.string()
      .description('注册到 ChatLuna 的工具名称')
      .default(DEFAULT_TOOL_NAME),
    toolDescription: Schema.string()
      .description('显示在 ChatLuna 工具列表中的描述')
      .default('用于搜索网易云音乐或 QQ 音乐并在当前聊天中发送整首歌曲音频、语音或音乐卡片；除非用户明确要求切换发送方式，否则不要传 sendMode；audio-url-model 模式返回链接后不要再次传 index 调用工具。'),
    searchLimit: Schema.natural()
      .min(1)
      .max(10)
      .step(1)
      .description('每个平台每次搜索返回的候选歌曲数量')
      .default(5),
    enableNetEaseSearch: Schema.boolean()
      .description('启用网易云音乐搜索')
      .default(true),
    enableQQMusicSearch: Schema.boolean()
      .description('启用 QQ 音乐搜索（QQ 音乐接口和卡片发送并不稳定，可能因歌曲或平台限制失败）')
      .default(false)
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
      Schema.const('audio-url-model').description('返回远程音频链接给模型'),
      Schema.const('audio-url').description('直接发送远程音频链接'),
      Schema.const('file').description('把远程音频链接作为文件发送'),
      Schema.const('music-card').description('按歌曲来源发送音乐卡片')
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
