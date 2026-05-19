// 歌曲发送模块
// 根据配置把歌曲发送为音频 URL、音频 buffer、文件或音乐卡片
// 模型返回链接模式由播放流程处理，不在这里发送消息

import { h, type Session } from 'koishi'

import { fetchSongBuffer } from './network'
import type { Config, MusicCardPayload } from './types'

/** 按配置发送歌曲。 */
export async function sendSongByMode(session: Session, src: string | MusicCardPayload, config: Config) {
  const source = typeof src === 'string' ? src : src.id

  switch (config.sendMode) {
    case 'audio-url':
      await session.send(h.text(source))
      return
    case 'audio-url-model':
      return
    case 'audio-buffer': {
      const buffer = await fetchSongBuffer(source)
      await session.send(h.audio(buffer, 'audio/mpeg'))
      return
    }
    case 'file': {
      const filename = new URL(source).pathname.split('/').pop() || 'song.mp3'
      await session.send(h.file(source, { title: filename }))
      return
    }
    case 'music-card':
      try {
        await session.send(h('onebot:music', {
          type: typeof src === 'string' || src.platform === 'netease' ? '163' : 'qq',
          id: source
        }))
      } catch (error) {
        if (typeof src !== 'string' && src.platform === 'qq' && src.url) {
          await session.send(h.text(src.url))
          return
        }

        throw error
      }
      return
  }
}
