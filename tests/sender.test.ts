// 歌曲发送模块测试
// 验证各发送模式会生成对应 Koishi 消息元素或保持静默

import { h, type Element, type Session } from 'koishi'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../src/types'
import { sendSongByMode } from '../src/sender'
import { fetchSongBuffer } from '../src/network'

vi.mock('../src/network', () => ({
  fetchSongBuffer: vi.fn()
}))

const baseConfig: Config = {
  toolName: 'music_voice',
  toolDescription: '自定义音乐工具描述。',
  searchLimit: 5,
  enableNetEaseSearch: true,
  enableQQMusicSearch: false,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
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

describe('sendSongByMode', () => {
  it('sends remote audio URL as text in audio-url mode', async () => {
    const { session, send } = createSession()

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', baseConfig)

    const sent = send.mock.calls[0][0] as Element
    expect(String(sent)).toBe('https://cdn.example.com/song.mp3')
    expect(h.select([sent], 'audio')).toHaveLength(0)
  })

  it('does not send in audio-url-model mode', async () => {
    const { session, send } = createSession()

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', {
      ...baseConfig,
      sendMode: 'audio-url-model'
    })

    expect(send).not.toHaveBeenCalled()
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

  it('sends NetEase music card in netease-card mode', async () => {
    const { session, send } = createSession()

    await sendSongByMode(session, '186016', {
      ...baseConfig,
      sendMode: 'netease-card'
    })

    expect(fetchSongBuffer).not.toHaveBeenCalled()
    const sent = send.mock.calls[0][0] as Element
    expect(sent.type).toBe('onebot:music')
    expect(sent.attrs.type).toBe('163')
    expect(sent.attrs.id).toBe('186016')
  })

  it('sends QQ music card in music-card mode', async () => {
    const { session, send } = createSession()

    await sendSongByMode(session, {
      platform: 'qq',
      id: '107192078',
      url: 'https://y.qq.com/n/ryqq/songDetail/003OUlho2HcRHC'
    }, {
      ...baseConfig,
      sendMode: 'music-card'
    })

    expect(fetchSongBuffer).not.toHaveBeenCalled()
    const sent = send.mock.calls[0][0] as Element
    expect(sent.type).toBe('onebot:music')
    expect(sent.attrs.type).toBe('qq')
    expect(sent.attrs.id).toBe('107192078')
  })

  it('falls back to a QQ Music link when QQ music card sending fails', async () => {
    const send = vi.fn<SendFn>()
      .mockRejectedValueOnce(new Error('retcode 1200'))
      .mockResolvedValueOnce(['message-id'])
    const session = { send } as Pick<Session, 'send'> as Session

    await sendSongByMode(session, {
      platform: 'qq',
      id: '494220528',
      url: 'https://y.qq.com/n/ryqq/songDetail/003m6lvL23QAIP'
    }, {
      ...baseConfig,
      sendMode: 'music-card'
    })

    expect(send).toHaveBeenCalledTimes(2)
    const fallback = send.mock.calls[1][0] as Element
    expect(String(fallback)).toBe('https://y.qq.com/n/ryqq/songDetail/003m6lvL23QAIP')
  })
})
