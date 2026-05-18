// 歌曲发送模块
// 根据配置把歌曲直链发送为音频 URL、音频 buffer 或文件

import { promises as fs } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { h, type Session } from 'koishi'

import { downloadSongFile, fetchSongBuffer } from './network'
import type { Config } from './types'

/** 按配置发送生成提示。 */
export async function sendGenerationTip(session: Session, tip: string) {
  const normalized = tip.trim()

  if (!normalized) {
    return
  }

  await session.send(h.text(normalized))
}

/** 按配置发送歌曲。 */
export async function sendSongByMode(session: Session, src: string, config: Config) {
  switch (config.sendMode) {
    case 'audio-url':
      await session.send(h.audio(src))
      return
    case 'audio-buffer': {
      const buffer = await fetchSongBuffer(src)
      await session.send(h.audio(buffer, 'audio/mpeg'))
      return
    }
    case 'file': {
      const tempFilePath = await downloadSongFile(src)

      try {
        await session.send(h.file(pathToFileURL(tempFilePath).href))
      } finally {
        await fs.unlink(tempFilePath).catch(() => {})
      }

      return
    }
  }
}
