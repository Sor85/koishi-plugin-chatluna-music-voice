// 歌曲发送模块
// 根据配置把歌曲直链发送为音频 URL、音频 buffer 或文件

import { h, type Session } from 'koishi'

import { fetchSongBuffer } from './network'
import type { Config } from './types'

/** 按配置发送歌曲。 */
export async function sendSongByMode(session: Session, src: string, config: Config) {
  switch (config.sendMode) {
    case 'audio-url':
      await session.send(h.text(src))
      return
    case 'audio-buffer': {
      const buffer = await fetchSongBuffer(src)
      await session.send(h.audio(buffer, 'audio/mpeg'))
      return
    }
    case 'file': {
      const filename = new URL(src).pathname.split('/').pop() || 'song.mp3'
      await session.send(h.file(src, { title: filename }))
      return
    }
  }
}
