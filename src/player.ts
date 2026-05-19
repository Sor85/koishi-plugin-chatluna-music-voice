// 音乐播放主流程
// 串联搜索、候选歌单、选歌、直链解析和消息发送

import type { Session } from 'koishi'

import { searchNetEase, resolveSongSource } from './network'
import { sendSongByMode } from './sender'
import type { Config, MusicToolResult, PluginLogger, SendMode, SongData } from './types'

/** 音乐播放流程的可替换依赖，便于测试和解耦。 */
export interface PlayNeteaseMusicDependencies {
  search: typeof searchNetEase
  resolveSource: typeof resolveSongSource
  send: typeof sendSongByMode
}

const defaultDependencies: PlayNeteaseMusicDependencies = {
  search: searchNetEase,
  resolveSource: resolveSongSource,
  send: sendSongByMode
}

const silentToolResult = {
  lc_direct_tool_output: true,
  replyEmitted: true
} as const

/** 格式化候选歌曲列表。 */
function formatCandidateList(songs: SongData[]): string {
  const lines = songs
    .map((s, i) => `${i + 1}. ${s.name} - ${s.artists}（${s.albumName}）`)
    .join('\n')
  return (
    `找到以下候选歌曲：\n${lines}\n\n请根据用户想听的歌曲，再次调用本工具并传入对应 index。`
  )
}

/** 解析直链并发送指定歌曲，返回操作结果文本。 */
async function sendSelectedSong(
  session: Session,
  config: Config,
  selected: SongData,
  logger: PluginLogger,
  deps: PlayNeteaseMusicDependencies,
  sendMode?: SendMode,
  silentResult = false
): Promise<MusicToolResult> {
  const effectiveConfig = sendMode === undefined ? config : { ...config, sendMode }

  if (effectiveConfig.sendMode === 'netease-card') {
    try {
      await deps.send(session, String(selected.id), effectiveConfig)
    } catch (error) {
      logger.error('歌曲语音发送失败', error)
      return '找到了歌曲，但语音发送失败。'
    }

    logger.info('已发送歌曲', `${selected.name} - ${selected.artists}`)
    return silentResult ? silentToolResult : `已发送：${selected.name} - ${selected.artists}`
  }

  let src: string

  try {
    src = await deps.resolveSource(config, selected.id, logger)
  } catch (error) {
    logger.warn('歌曲直链获取失败', error)
    return '找到了歌曲，但暂时无法获取播放地址。'
  }

  try {
    await deps.send(session, src, effectiveConfig)
  } catch (error) {
    logger.error('歌曲语音发送失败', error)
    return '找到了歌曲，但语音发送失败。'
  }

  logger.info('已发送歌曲', `${selected.name} - ${selected.artists}`)
  return silentResult ? silentToolResult : `已发送：${selected.name} - ${selected.artists}`
}

/** 搜索并发送一首网易云音乐。 */
export async function playNeteaseMusic(
  session: Session,
  config: Config,
  query: string,
  logger: PluginLogger,
  index?: number,
  sendModeOrDeps?: SendMode | PlayNeteaseMusicDependencies,
  depsOrSendMode?: PlayNeteaseMusicDependencies | SendMode
) {
  const sendMode = typeof sendModeOrDeps === 'string'
    ? sendModeOrDeps
    : typeof depsOrSendMode === 'string'
      ? depsOrSendMode
      : undefined
  const deps = typeof sendModeOrDeps === 'object'
    ? sendModeOrDeps
    : typeof depsOrSendMode === 'object'
      ? depsOrSendMode
      : defaultDependencies
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

  if (config.searchLimit > 1) {
    if (index === undefined) {
      return formatCandidateList(songs)
    }
    if (index < 1 || index > songs.length) {
      return `序号无效，请选择 1-${songs.length} 之间的数字。`
    }
    return sendSelectedSong(session, config, songs[index - 1], logger, deps, sendMode, true)
  }

  return sendSelectedSong(session, config, songs[0], logger, deps, sendMode)
}
