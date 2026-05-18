// 音乐播放主流程
// 串联搜索、选歌、直链解析和消息发送

import type { Session } from 'koishi'

import { searchNetEase, resolveSongSource } from './network'
import { selectBestSong } from './selector'
import { sendGenerationTip, sendSongByMode } from './sender'
import type { Config, PluginLogger, SongData } from './types'

export interface PlayNeteaseMusicDependencies {
  search: typeof searchNetEase
  select: (songs: SongData[], query: string) => SongData | undefined
  resolveSource: typeof resolveSongSource
  sendTip: typeof sendGenerationTip
  send: typeof sendSongByMode
}

const defaultDependencies: PlayNeteaseMusicDependencies = {
  search: searchNetEase,
  select: selectBestSong,
  resolveSource: resolveSongSource,
  sendTip: sendGenerationTip,
  send: sendSongByMode
}

/** 搜索并发送一首网易云音乐。 */
export async function playNeteaseMusic(
  session: Session,
  config: Config,
  query: string,
  logger: PluginLogger,
  deps: PlayNeteaseMusicDependencies = defaultDependencies
) {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return '没有找到合适歌曲。'
  }

  let songs: SongData[]

  try {
    songs = await deps.search(config, normalizedQuery, config.searchLimit, logger)
  } catch (error) {
    logger.warn('网易云搜索失败', error)
    return '音乐服务暂时不可用。'
  }

  if (songs.length < 1) {
    logger.debug('网易云搜索无结果', normalizedQuery)
    return '没有找到合适歌曲。'
  }

  const selected = deps.select(songs, normalizedQuery)

  if (!selected) {
    return '没有找到合适歌曲。'
  }

  let src: string

  try {
    src = await deps.resolveSource(config, selected.id, logger)
  } catch (error) {
    logger.warn('歌曲直链获取失败', error)
    return '找到了歌曲，但暂时无法获取播放地址。'
  }

  try {
    await deps.sendTip(session, config.generationTip)
    await deps.send(session, src, config)
  } catch (error) {
    logger.error('歌曲语音发送失败', error)
    return '找到了歌曲，但语音发送失败。'
  }

  logger.info('已发送歌曲', `${selected.name} - ${selected.artists}`)
  return `已发送：${selected.name} - ${selected.artists}`
}
