// 歌曲选择策略
// 根据 query 对候选歌曲打分并返回最匹配的一首

import type { SongData } from './types'

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, '')
}

function splitTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[\s,，/]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function scoreSong(song: SongData, query: string) {
  const normalizedQuery = normalize(query)

  if (!normalizedQuery) {
    return 0
  }

  const normalizedName = normalize(song.name)
  const normalizedArtists = normalize(song.artists)
  const tokens = splitTokens(query)
  let score = 0

  if (normalizedName === normalizedQuery) {
    score += 100
  }

  if (normalizedQuery.includes(normalizedName)) {
    score += 70
  }

  if (normalizedName.includes(normalizedQuery)) {
    score += 60
  }

  for (const token of tokens) {
    const normalizedToken = normalize(token)

    if (normalizedName === normalizedToken) {
      score += 40
      continue
    }

    if (normalizedName.includes(normalizedToken)) {
      score += 20
    }

    if (normalizedArtists.includes(normalizedToken)) {
      score += 10
    }
  }

  if (score > 0 && /live|伴奏|翻唱|remix/i.test(song.name)) {
    score -= 5
  }

  return score
}

/** 从搜索候选中选出最符合 query 的歌曲。 */
export function selectBestSong(songs: SongData[], query: string) {
  if (songs.length < 1) {
    return undefined
  }

  let bestSong = songs[0]
  let bestScore = scoreSong(bestSong, query)

  for (const song of songs.slice(1)) {
    const score = scoreSong(song, query)

    if (score > bestScore) {
      bestSong = song
      bestScore = score
    }
  }

  return bestSong
}
