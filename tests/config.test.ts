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

  it('tells the model to pass default sendMode for normal tool calls', () => {
    const schema = stringifyConfigSchema()

    expect(schema).toContain('sendMode 请传 default')
    expect(schema).toContain('Koishi 前端中用户选择的默认发送方式')
  })
})
