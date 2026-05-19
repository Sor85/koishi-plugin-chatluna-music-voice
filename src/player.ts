// 音乐播放主流程
// 串联搜索、候选歌单、选歌、直链解析和消息发送

import type { Session } from 'koishi'

import { searchMusic, resolveSongSource } from './network'
import { sendSongByMode } from './sender'
import type { Config, MusicCardPayload, MusicPlatform, MusicToolResult, PluginLogger, SendMode, SongData } from './types'

/** 音乐播放流程的可替换依赖，便于测试和解耦。 */
export interface PlayNeteaseMusicDependencies {
  search: typeof searchMusic
  resolveSource: typeof resolveSongSource
  send: typeof sendSongByMode
}

const defaultDependencies: PlayNeteaseMusicDependencies = {
  search: searchMusic,
  resolveSource: resolveSongSource,
  send: sendSongByMode
}

const silentToolResult = {
  lc_direct_tool_output: true,
  replyEmitted: true
} as const

function getSongPlatform(song: SongData): MusicPlatform {
  return song.platform ?? 'netease'
}

function getSourceTarget(song: SongData) {
  return getSongPlatform(song) === 'netease' ? song.id : song
}

function getCardPayload(song: SongData): MusicCardPayload | string {
  const platform = getSongPlatform(song)
  const id = song.cardId ?? String(song.id)

  if (platform === 'netease') {
    return id
  }

  const url = song.sourceId
    ? `https://y.qq.com/n/ryqq/songDetail/${encodeURIComponent(song.sourceId)}`
    : `https://i.y.qq.com/v8/playsong.html?songid=${encodeURIComponent(id)}`

  return { platform, id, url }
}

function hasMultiplePlatforms(songs: SongData[]) {
  return new Set(songs.map(getSongPlatform)).size > 1
}

function getPlatformTitle(platform: MusicPlatform) {
  return platform === 'qq' ? 'QQ音乐搜索结果：' : '网易云音乐搜索结果：'
}

function formatSongLine(song: SongData, index: number) {
  return `${index + 1}. ${song.name} - ${song.artists}（${song.albumName}）`
}

/** 格式化候选歌曲列表。 */
function formatCandidateList(songs: SongData[]): string {
  if (hasMultiplePlatforms(songs)) {
    const lines: string[] = []

    for (const platform of ['netease', 'qq'] as const) {
      const platformSongs = songs
        .map((song, index) => ({ song, index }))
        .filter(({ song }) => getSongPlatform(song) === platform)

      if (platformSongs.length < 1) continue
      if (lines.length > 0) lines.push('')
      lines.push(getPlatformTitle(platform))
      lines.push(...platformSongs.map(({ song, index }) => formatSongLine(song, index)))
    }

    return `${lines.join('\n')}\n\n请根据用户想听的歌曲，再次调用本工具并传入对应 index。`
  }

  const lines = songs.map(formatSongLine).join('\n')
  return (
    `找到以下候选歌曲：\n${lines}\n\n请根据用户想听的歌曲，再次调用本工具并传入对应 index。`
  )
}

/** 格式化带直链的候选歌曲列表。 */
async function formatCandidateListWithSources(
  config: Config,
  songs: SongData[],
  logger: PluginLogger,
  deps: PlayNeteaseMusicDependencies
) {
  const lines = hasMultiplePlatforms(songs) ? [] : ['找到以下候选歌曲：']

  for (const platform of ['netease', 'qq'] as const) {
    const platformSongs = songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => !hasMultiplePlatforms(songs) || getSongPlatform(song) === platform)

    if (platformSongs.length < 1) continue
    if (hasMultiplePlatforms(songs)) {
      if (lines.length > 0) lines.push('')
      lines.push(getPlatformTitle(platform))
    }

    for (const { song, index } of platformSongs) {
      lines.push(formatSongLine(song, index))

      try {
        const src = await deps.resolveSource(config, getSourceTarget(song), logger)
        lines.push(`链接：${src}`)
      } catch (error) {
        logger.warn('歌曲直链获取失败', error)
        lines.push('链接：获取失败')
      }
    }

    if (!hasMultiplePlatforms(songs)) break
  }

  return `${lines.join('\n')}\n\n请直接从以上链接中选择，不要再次调用本工具传入 index。`
}

/** 解析直链并返回给模型，不向当前聊天发送消息。 */
async function returnSongSourceToModel(
  config: Config,
  selected: SongData,
  logger: PluginLogger,
  deps: PlayNeteaseMusicDependencies
) {
  try {
    const src = await deps.resolveSource(config, getSourceTarget(selected), logger)
    return `远程音频链接：${src}`
  } catch (error) {
    logger.warn('歌曲直链获取失败', error)
    return '找到了歌曲，但暂时无法获取播放地址。'
  }
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

  if (effectiveConfig.sendMode === 'music-card' || effectiveConfig.sendMode === 'netease-card') {
    try {
      await deps.send(session, getCardPayload(selected), effectiveConfig)
    } catch (error) {
      logger.error('歌曲语音发送失败', error)
      return '找到了歌曲，但语音发送失败。'
    }

    logger.info('已发送歌曲', `${selected.name} - ${selected.artists}`)
    return silentResult ? silentToolResult : `已发送：${selected.name} - ${selected.artists}`
  }

  let src: string

  try {
    src = await deps.resolveSource(config, getSourceTarget(selected), logger)
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
  const effectiveSendMode = sendMode ?? config.sendMode
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
      if (effectiveSendMode === 'audio-url-model') {
        return formatCandidateListWithSources(config, songs, logger, deps)
      }
      return formatCandidateList(songs)
    }
    if (index < 1 || index > songs.length) {
      return `序号无效，请选择 1-${songs.length} 之间的数字。`
    }
    if (effectiveSendMode === 'audio-url-model') {
      return returnSongSourceToModel(config, songs[index - 1], logger, deps)
    }
    return sendSelectedSong(session, config, songs[index - 1], logger, deps, sendMode, true)
  }

  if (effectiveSendMode === 'audio-url-model') {
    return returnSongSourceToModel(config, songs[0], logger, deps)
  }

  return sendSelectedSong(session, config, songs[0], logger, deps, sendMode)
}
