// Koishi 配置面板测试
// 验证前端可见配置项和描述文案

import { describe, expect, it } from 'vitest'

import { Config } from '../src/config'

function stringifyConfigSchema() {
  return JSON.stringify(Config.toJSON())
}

describe('Config', () => {
  it('does not expose legacy netease-card as a frontend send mode option', () => {
    const schema = stringifyConfigSchema()

    expect(schema).toContain('music-card')
    expect(schema).not.toContain('netease-card')
    expect(schema).not.toContain('发送网易云音乐卡片（旧配置兼容）')
  })

  it('warns that QQ Music search is unstable in the frontend description', () => {
    const schema = stringifyConfigSchema()

    expect(schema).toContain('启用 QQ 音乐搜索')
    expect(schema).toContain('不稳定')
  })

  it('does not ask the model to pass sendMode in default frontend description', () => {
    const schema = stringifyConfigSchema()

    expect(schema).not.toContain('sendMode 请传 default')
    expect(schema).toContain('用于搜索网易云音乐或 QQ 音乐并在当前聊天中发送整首歌曲音频、语音或音乐卡片。')
  })

  it('disables AI sendMode parameter by default in frontend config', () => {
    const schema = stringifyConfigSchema()

    expect(schema).toContain('允许 AI 临时切换发送方式')
    expect(schema).toContain('关闭后工具不会向 AI 暴露 sendMode 参数')
    expect(schema).toContain('"allowAISendMode"')
    expect(schema).toContain('"default":false')
  })

  it('disables audio-url-model short links by default and explains the OneBot boundary', () => {
    const schema = stringifyConfigSchema()

    expect(schema).toContain('启用 audio-url-model 本地 302 短链')
    expect(schema).toContain('仅影响“返回远程音频链接给模型”')
    expect(schema).toContain('OneBot 必须能访问')
    expect(schema).toContain('"enableAudioUrlModelShortLink"')
    expect(schema).toContain('"audioShortLinkBaseUrl"')
    expect(schema).toContain('"default":false')
  })
})
