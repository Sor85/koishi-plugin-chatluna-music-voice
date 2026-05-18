// 插件日志封装
// debug 日志受配置开关控制，其余日志直接输出

import type { Context } from 'koishi'

import type { Config, PluginLogger } from './types'

/** 创建受 debug 配置控制的插件日志器。 */
export function createPluginLogger(ctx: Context, config: Config): PluginLogger {
  const logger = ctx.logger('chatluna-music')

  return {
    debug(message: unknown, ...args: unknown[]) {
      if (config.debug) {
        logger.debug(message, ...args)
      }
    },
    info(message: unknown, ...args: unknown[]) {
      logger.info(message, ...args)
    },
    warn(message: string, error?: unknown) {
      if (error === undefined) {
        logger.warn(message)
        return
      }

      logger.warn(message, error)
    },
    error(message: string, error?: unknown) {
      if (error === undefined) {
        logger.error(message)
        return
      }

      logger.error(message, error)
    }
  }
}
