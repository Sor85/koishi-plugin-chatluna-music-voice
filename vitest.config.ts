// Vitest 配置
// 使用 Node 环境测试 Koishi 插件的纯 TypeScript 模块

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      koishi: '@koishijs/core'
    }
  },
  test: {
    environment: 'node',
    globals: false,
    restoreMocks: true
  }
})
