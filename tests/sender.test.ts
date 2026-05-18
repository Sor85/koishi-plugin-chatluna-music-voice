// 歌曲发送模块测试
// 验证三种发送模式会生成对应 Koishi 消息元素

import { h, type Session } from '@koishijs/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../src/types'
import { sendGenerationTip, sendSongByMode } from '../src/sender'
import { downloadSongFile, fetchSongBuffer } from '../src/network'

vi.mock('koishi', () => {
  const core = require('@koishijs/core')
  return { ...core }
})

vi.mock('../src/network', () => ({
  downloadSongFile: vi.fn(),
  fetchSongBuffer: vi.fn()
}))

const baseConfig: Config = {
  toolName: 'play_netease_music_as_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

function createSession() {
  const send = vi.fn(async () => ['message-id'])
  return { send } as unknown as Session
}

function getSendMock(session: Session) {
  return (session as unknown as { send: ReturnType<typeof vi.fn> }).send
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('sendGenerationTip', () => {
  it('sends no message for empty tip', async () => {
    const session = createSession()

    await sendGenerationTip(session, '   ')

    expect(getSendMock(session)).not.toHaveBeenCalled()
  })

  it('sends a text tip when configured', async () => {
    const session = createSession()

    await sendGenerationTip(session, '正在找歌…')

    expect(String(getSendMock(session).mock.calls[0][0])).toContain('正在找歌')
  })
})

describe('sendSongByMode', () => {
  it('sends remote audio URL in audio-url mode', async () => {
    const session = createSession()

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', baseConfig)

    const sent = getSendMock(session).mock.calls[0][0]
    const audio = h.select([sent], 'audio')
    expect(audio[0].attrs.src).toBe('https://cdn.example.com/song.mp3')
  })

  it('downloads and sends buffer in audio-buffer mode', async () => {
    const session = createSession()
    vi.mocked(fetchSongBuffer).mockResolvedValue(Buffer.from([1, 2, 3]))

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', {
      ...baseConfig,
      sendMode: 'audio-buffer'
    })

    expect(fetchSongBuffer).toHaveBeenCalledWith('https://cdn.example.com/song.mp3')
    const sent = getSendMock(session).mock.calls[0][0]
    const audio = h.select([sent], 'audio')
    expect(audio[0].attrs.src).toContain('data:audio/mpeg;base64,')
  })

  it('downloads and sends file in file mode', async () => {
    const session = createSession()
    vi.mocked(downloadSongFile).mockResolvedValue('/tmp/chatluna-music-song.mp3')

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', {
      ...baseConfig,
      sendMode: 'file'
    })

    expect(downloadSongFile).toHaveBeenCalledWith('https://cdn.example.com/song.mp3')
    const sent = getSendMock(session).mock.calls[0][0]
    const file = h.select([sent], 'file')
    expect(file[0].attrs.src).toBe('file:///tmp/chatluna-music-song.mp3')
  })
})
