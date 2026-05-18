// 歌曲发送模块测试
// 验证三种发送模式会生成对应 Koishi 消息元素

import { h, type Element, type Session } from 'koishi'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../src/types'
import { sendGenerationTip, sendSongByMode } from '../src/sender'
import { fetchSongBuffer } from '../src/network'

vi.mock('../src/network', () => ({
  fetchSongBuffer: vi.fn()
}))

const baseConfig: Config = {
  toolName: 'music_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

type SendFn = (fragment: Parameters<Session['send']>[0]) => Promise<string[]>

function createSession() {
  const send = vi.fn<SendFn>(async () => ['message-id'])
  const session = { send } as Pick<Session, 'send'> as Session
  return { session, send }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('sendGenerationTip', () => {
  it('sends no message for empty tip', async () => {
    const { session, send } = createSession()

    await sendGenerationTip(session, '   ')

    expect(send).not.toHaveBeenCalled()
  })

  it('sends a text tip when configured', async () => {
    const { session, send } = createSession()

    await sendGenerationTip(session, '正在找歌…')

    expect(String(send.mock.calls[0][0])).toContain('正在找歌')
  })
})

describe('sendSongByMode', () => {
  it('sends remote audio URL in audio-url mode', async () => {
    const { session, send } = createSession()

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', baseConfig)

    const sent = send.mock.calls[0][0] as Element
    const audio = h.select([sent], 'audio')
    expect(audio[0].attrs.src).toBe('https://cdn.example.com/song.mp3')
  })

  it('downloads and sends buffer in audio-buffer mode', async () => {
    const { session, send } = createSession()
    vi.mocked(fetchSongBuffer).mockResolvedValue(Buffer.from([1, 2, 3]))

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', {
      ...baseConfig,
      sendMode: 'audio-buffer'
    })

    expect(fetchSongBuffer).toHaveBeenCalledWith('https://cdn.example.com/song.mp3')
    const sent = send.mock.calls[0][0] as Element
    const audio = h.select([sent], 'audio')
    expect(audio[0].attrs.src).toContain('data:audio/mpeg;base64,')
  })

  it('sends remote file URL in file mode', async () => {
    const { session, send } = createSession()

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', {
      ...baseConfig,
      sendMode: 'file'
    })

    const sent = send.mock.calls[0][0] as Element
    const file = h.select([sent], 'file')
    expect(file[0].attrs.src).toBe('https://cdn.example.com/song.mp3')
    expect(file[0].attrs.title).toBe('song.mp3')
  })
})
