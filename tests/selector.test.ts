// 选歌策略测试
// 验证工具只基于 query 从候选列表中选择歌曲

import { describe, expect, it } from 'vitest'

import type { SongData } from '../src/types'
import { selectBestSong } from '../src/selector'

const songs: SongData[] = [
  { id: 1, name: '晴天 Live', artists: '周杰伦', albumName: '演唱会', duration: 270000 },
  { id: 2, name: '晴天', artists: '周杰伦', albumName: '叶惠美', duration: 269000 },
  { id: 3, name: '阴天', artists: '莫文蔚', albumName: '就是莫文蔚', duration: 250000 }
]

describe('selectBestSong', () => {
  it('prefers exact title match', () => {
    expect(selectBestSong(songs, '晴天')).toEqual(songs[1])
  })

  it('uses artist token to improve selection', () => {
    const candidates: SongData[] = [
      { id: 10, name: '匆匆那年', artists: '王菲', albumName: '专辑A', duration: 240000 },
      { id: 11, name: '匆匆那年', artists: '张学友', albumName: '专辑B', duration: 250000 }
    ]
    expect(selectBestSong(candidates, '王菲 匆匆那年')).toEqual(candidates[0])
  })

  it('falls back to the first song when nothing matches', () => {
    expect(selectBestSong(songs, '完全不存在')).toEqual(songs[0])
  })

  it('falls back to the first song for a blank query', () => {
    expect(selectBestSong(songs, '   ')).toEqual(songs[0])
  })

  it('returns undefined for an empty list', () => {
    expect(selectBestSong([], '晴天')).toBeUndefined()
  })
})
