# ChatLuna 音乐语音工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个独立 Koishi 插件，注册 ChatLuna 工具，让 AI 只传入 `query` 就能搜索网易云音乐并把整首歌按配置发送到当前会话。

**Architecture:** 插件通过 `ctx.chatluna.platform.registerTool()` 注册一个 `StructuredTool`，工具从 ChatLuna 调用配置中获取当前 `session`。音乐能力拆成网络检索、选歌、发送、编排、工具注册五个小模块，测试可以分别覆盖。第一版只支持网易云音乐和三种发送模式：`audio-url`、`audio-buffer`、`file`。

**Tech Stack:** Koishi v4、TypeScript、ChatLuna、LangChain `StructuredTool`、Zod、Vitest、Node 18+ `fetch`。

---

## Scope Check

本规格只包含一个可独立交付的子系统：ChatLuna 音乐语音工具。它不包含多音乐平台、QQ Markdown 歌单、命令交互、防刷限制或转码流程，因此不需要再拆成多个计划。

## File Structure

- Create: `package.json` — npm 包、Koishi 插件元信息、构建和测试脚本。
- Create: `tsconfig.json` — TypeScript 编译配置，输出到 `lib/`。
- Create: `vitest.config.ts` — Vitest Node 环境配置。
- Create: `src/index.ts` — Koishi 插件入口，声明依赖并注册工具。
- Create: `src/config.ts` — Koishi 控制台配置 Schema。
- Create: `src/constants.ts` — 预设 Meting API 和超时常量。
- Create: `src/types.ts` — 插件配置、歌曲数据、日志接口、工具输入类型。
- Create: `src/logger.ts` — 调试日志开关封装。
- Create: `src/network.ts` — 网易云搜索、Meting 直链解析、下载 buffer / 临时文件。
- Create: `src/selector.ts` — 根据 `query` 从搜索结果中选一首歌。
- Create: `src/sender.ts` — 三种发送模式。
- Create: `src/player.ts` — 搜索、选歌、解析直链、发送的主流程。
- Create: `src/tool.ts` — ChatLuna 工具类与注册函数。
- Create: `tests/network.test.ts` — 网络解析和 fetch 行为测试。
- Create: `tests/selector.test.ts` — 选歌策略测试。
- Create: `tests/sender.test.ts` — 发送模式测试。
- Create: `tests/player.test.ts` — 主流程成功和失败结果测试。
- Create: `tests/tool.test.ts` — ChatLuna 工具注册和会话读取测试。

Do not modify `chatluna-character` or `koishi-plugin-music-voice`. Do not remove the existing empty `test.txt` unless the user asks.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Create package metadata and scripts**

Write `package.json`:

```json
{
  "name": "koishi-plugin-chatluna-music",
  "description": "Let ChatLuna characters search NetEase Music and send songs as voice messages.",
  "version": "0.1.0",
  "main": "lib/index.js",
  "typings": "lib/index.d.ts",
  "files": [
    "lib",
    "src"
  ],
  "license": "MIT",
  "keywords": [
    "chatbot",
    "koishi",
    "plugin",
    "chatluna",
    "music",
    "voice",
    "netease"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "koishi": {
    "description": {
      "zh": "让 ChatLuna 角色自主搜索网易云音乐并发送为语音。",
      "en": "Let ChatLuna characters search NetEase Music and send songs as voice messages."
    },
    "service": {
      "required": [
        "chatluna"
      ]
    }
  },
  "peerDependencies": {
    "koishi": "^4.17.3",
    "koishi-plugin-chatluna": "*"
  },
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "koishi": "^4.17.3",
    "koishi-plugin-chatluna": "*",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": [
      "ES2022",
      "DOM"
    ],
    "declaration": true,
    "sourceMap": true,
    "outDir": "lib",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "vitest.config.ts"
  ],
  "exclude": [
    "lib",
    "node_modules"
  ]
}
```

- [ ] **Step 3: Create Vitest config**

Write `vitest.config.ts`:

```ts
// Vitest 配置
// 使用 Node 环境测试 Koishi 插件的纯 TypeScript 模块

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    restoreMocks: true
  }
})
```

- [ ] **Step 4: Create minimal plugin entry**

Write `src/index.ts`:

```ts
// ChatLuna 音乐语音工具插件入口
// 负责导出 Koishi 插件元信息和 apply 函数

import type { Context } from 'koishi'
import { Schema } from 'koishi'

export const name = 'chatluna-music'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

/** 注册 ChatLuna 音乐工具。 */
export function apply(_ctx: Context, _config: Config) {}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 6: Verify scaffold builds**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit with code 0 and `lib/index.js` plus `lib/index.d.ts` are generated.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/index.ts
git commit -m "$(cat <<'EOF'
chore: 搭建 ChatLuna 音乐插件工程

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Config, Types, Constants, Logger

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`
- Create: `src/config.ts`
- Create: `src/logger.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add shared types**

Write `src/types.ts`:

```ts
// ChatLuna 音乐工具共享类型
// 包含配置、歌曲数据、日志接口和工具输入

export type SourceMode = 'preset' | 'custom'

export type SendMode = 'audio-url' | 'audio-buffer' | 'file'

export interface Config {
  toolName: string
  searchLimit: number
  sourceMode: SourceMode
  customMetingApi: string
  sendMode: SendMode
  generationTip: string
  debug: boolean
}

export interface MusicToolInput {
  query: string
}

export interface SongData {
  id: number
  name: string
  artists: string
  albumName: string
  duration: number
}

export interface NetEaseSearchResponse {
  result?: {
    songs?: NetEaseSongItem[]
  }
}

export interface NetEaseSongItem {
  id: number
  name: string
  artists: Array<{ name: string }>
  album: { name: string }
  duration: number
}

export interface PluginLogger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (message: string, error?: unknown) => void
  error: (message: string, error?: unknown) => void
}
```

- [ ] **Step 2: Add constants**

Write `src/constants.ts`:

```ts
// 音乐请求常量
// 集中维护预设 Meting API 和网络超时时间

export const DEFAULT_TOOL_NAME = 'play_netease_music_as_voice'

export const PRESET_METING_APIS = [
  'https://api.injahow.cn/meting/',
  'https://api.qijieya.cn/meting/',
  'https://api.moeyao.cn/meting/',
  'https://meting.jinghuashang.cn/',
  'https://meting.qjqq.cn/',
  'https://api.crowya.com/meting/',
  'https://meting-api.mlj-dragon.cn/meting/',
  'https://api.amarea.cn/meting/'
]

export const SEARCH_TIMEOUT_MS = 5000

export const SOURCE_TIMEOUT_MS = 5000

export const DOWNLOAD_TIMEOUT_MS = 15000

export const REQUEST_TIMEOUT_REASON = 'chatluna-music-request-timeout'
```

- [ ] **Step 3: Add Koishi config schema**

Write `src/config.ts`:

```ts
// Koishi 控制台配置 Schema
// 定义 ChatLuna 音乐语音工具的可配置项

import { Schema } from 'koishi'

import { DEFAULT_TOOL_NAME } from './constants'
import type { Config as PluginConfig } from './types'

export const Config: Schema<PluginConfig> = Schema.intersect([
  Schema.object({
    toolName: Schema.string()
      .description('注册到 ChatLuna 的工具名称')
      .default(DEFAULT_TOOL_NAME),
    searchLimit: Schema.natural()
      .min(1)
      .max(10)
      .step(1)
      .description('每次搜索返回的候选歌曲数量')
      .default(5),
    generationTip: Schema.string()
      .description('发送歌曲前额外发送的提示文字，留空则不发送提示')
      .default('')
  }).description('基础设置'),

  Schema.object({
    sourceMode: Schema.union([
      Schema.const('preset').description('使用预设 Meting API 列表'),
      Schema.const('custom').description('使用自定义 Meting API')
    ])
      .role('radio')
      .description('歌曲直链 API 来源')
      .default('preset'),
    customMetingApi: Schema.string()
      .role('link')
      .description('自定义 Meting API 地址，仅在选择自定义来源时使用')
      .default('https://api.injahow.cn/meting/')
  }).description('请求设置'),

  Schema.object({
    sendMode: Schema.union([
      Schema.const('audio-url').description('直接发送远程音频链接'),
      Schema.const('audio-buffer').description('下载音频后发送 buffer'),
      Schema.const('file').description('下载临时文件后作为文件发送')
    ])
      .role('radio')
      .description('歌曲发送方式')
      .default('audio-url')
  }).description('发送设置'),

  Schema.object({
    debug: Schema.boolean()
      .description('输出详细调试日志')
      .default(false)
  }).description('开发者选项')
])
```

- [ ] **Step 4: Add logger wrapper**

Write `src/logger.ts`:

```ts
// 插件日志封装
// debug 日志受配置开关控制，其余日志直接输出

import type { Context } from 'koishi'

import type { Config, PluginLogger } from './types'

/** 创建受 debug 配置控制的插件日志器。 */
export function createPluginLogger(ctx: Context, config: Config): PluginLogger {
  const logger = ctx.logger('chatluna-music')

  return {
    debug(...args: unknown[]) {
      if (config.debug) {
        logger.debug(...args)
      }
    },
    info(...args: unknown[]) {
      logger.info(...args)
    },
    warn(message: string, error?: unknown) {
      if (error === undefined) {
        logger.warn(message)
        return
      }

      logger.warn(message, error)
    },
    error(message: string, error?: unknown) {
      if (error === undefined) {
        logger.error(message)
        return
      }

      logger.error(message, error)
    }
  }
}
```

- [ ] **Step 5: Export real config from entry**

Replace `src/index.ts` with:

```ts
// ChatLuna 音乐语音工具插件入口
// 负责声明 Koishi 插件依赖并注册 ChatLuna 工具

import type { Context } from 'koishi'

import { Config } from './config'
import type { Config as PluginConfig } from './types'

export const name = 'chatluna-music'

export const inject = {
  required: ['chatluna']
}

export { Config }

/** 注册 ChatLuna 音乐工具。 */
export function apply(_ctx: Context, _config: PluginConfig) {}
```

- [ ] **Step 6: Verify types**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit config and types**

```bash
git add src/index.ts src/config.ts src/constants.ts src/types.ts src/logger.ts
git commit -m "$(cat <<'EOF'
feat: 添加插件配置和共享类型

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Network Module

**Files:**
- Create: `tests/network.test.ts`
- Create: `src/network.ts`

- [ ] **Step 1: Write failing network tests**

Write `tests/network.test.ts`:

```ts
// 网络模块测试
// 验证网易云搜索解析、Meting URL 解析和下载能力

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Config, PluginLogger } from '../src/types'
import {
  fetchSongBuffer,
  parseMetingUrl,
  parseSearchResponse,
  resolveSongSource,
  searchNetEase
} from '../src/network'

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const baseConfig: Config = {
  toolName: 'play_netease_music_as_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('parseSearchResponse', () => {
  it('converts NetEase songs to SongData', () => {
    const result = parseSearchResponse(JSON.stringify({
      result: {
        songs: [{
          id: 186016,
          name: '晴天',
          artists: [{ name: '周杰伦' }],
          album: { name: '叶惠美' },
          duration: 269000
        }]
      }
    }))

    expect(result).toEqual([{
      id: 186016,
      name: '晴天',
      artists: '周杰伦',
      albumName: '叶惠美',
      duration: 269000
    }])
  })

  it('returns null for invalid search JSON', () => {
    expect(parseSearchResponse('not json')).toBeNull()
  })
})

describe('parseMetingUrl', () => {
  it('parses a plain URL response', () => {
    expect(parseMetingUrl('https://cdn.example.com/song.mp3')).toBe('https://cdn.example.com/song.mp3')
  })

  it('parses a JSON URL response', () => {
    expect(parseMetingUrl('{"url":"https://cdn.example.com/song.mp3"}')).toBe('https://cdn.example.com/song.mp3')
  })

  it('rejects non-http URLs', () => {
    expect(parseMetingUrl('{"url":"file:///tmp/song.mp3"}')).toBeNull()
  })
})

describe('searchNetEase', () => {
  it('calls NetEase search API and returns songs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        songs: [{
          id: 1,
          name: '晴天',
          artists: [{ name: '周杰伦' }],
          album: { name: '叶惠美' },
          duration: 269000
        }]
      }
    }))))

    await expect(searchNetEase(baseConfig, '晴天', 5, logger)).resolves.toEqual([{
      id: 1,
      name: '晴天',
      artists: '周杰伦',
      albumName: '叶惠美',
      duration: 269000
    }])
  })
})

describe('resolveSongSource', () => {
  it('uses custom Meting API when sourceMode is custom', async () => {
    const fetchMock = vi.fn(async () => new Response('{"url":"https://cdn.example.com/song.mp3"}'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveSongSource({
      ...baseConfig,
      sourceMode: 'custom',
      customMetingApi: 'https://music.example.com/meting'
    }, 123, logger)).resolves.toBe('https://cdn.example.com/song.mp3')

    expect(String(fetchMock.mock.calls[0][0])).toBe('https://music.example.com/meting?type=url&id=123')
  })
})

describe('fetchSongBuffer', () => {
  it('downloads audio content into a Buffer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'audio/mpeg' }
    })))

    await expect(fetchSongBuffer('https://cdn.example.com/song.mp3')).resolves.toEqual(Buffer.from([1, 2, 3]))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/network.test.ts
```

Expected: FAIL because `src/network.ts` does not exist.

- [ ] **Step 3: Implement network module**

Write `src/network.ts`:

```ts
// 网易云音乐网络请求模块
// 负责搜索歌曲、解析 Meting 直链并下载音频内容

import { promises as fs } from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

import {
  DOWNLOAD_TIMEOUT_MS,
  PRESET_METING_APIS,
  REQUEST_TIMEOUT_REASON,
  SEARCH_TIMEOUT_MS,
  SOURCE_TIMEOUT_MS
} from './constants'
import type { Config, NetEaseSearchResponse, PluginLogger, SongData } from './types'

interface RequestCandidate<T> {
  label: string
  run: (signal: AbortSignal) => Promise<T>
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function createAbortTimeout(controller: AbortController, timeoutMs: number) {
  const timeout = setTimeout(() => controller.abort(REQUEST_TIMEOUT_REASON), timeoutMs)
  return () => clearTimeout(timeout)
}

async function requestText(targetUrl: string, signal: AbortSignal) {
  const response = await fetch(targetUrl, { method: 'GET', signal })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return await response.text()
}

async function requestArrayBuffer(targetUrl: string, signal: AbortSignal) {
  const response = await fetch(targetUrl, { method: 'GET', signal })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type')
  }
}

async function raceRequests<T>(
  candidates: RequestCandidate<string>[],
  timeoutMs: number,
  parser: (content: string) => T | null,
  description: string,
  logger: PluginLogger
) {
  const controllers = candidates.map(() => new AbortController())
  const tasks = candidates.map(async (candidate, index) => {
    const controller = controllers[index]
    const disposeTimeout = createAbortTimeout(controller, timeoutMs)

    try {
      logger.debug(`${description} 开始请求`, candidate.label)
      const raw = await candidate.run(controller.signal)
      const parsed = parser(raw)

      if (parsed === null) {
        throw new Error('返回结果不可用')
      }

      logger.debug(`${description} 命中`, candidate.label)
      return parsed
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason === REQUEST_TIMEOUT_REASON) {
        throw new Error(`${candidate.label} 请求超时`)
      }

      if (controller.signal.aborted) {
        throw new Error(`${candidate.label} 已取消`)
      }

      throw new Error(`${candidate.label} 请求失败：${getErrorMessage(error)}`)
    } finally {
      disposeTimeout()
    }
  })

  try {
    return await Promise.any(tasks)
  } catch (error) {
    logger.error(`${description} 全部失败`, error)
    throw error
  } finally {
    for (const controller of controllers) {
      controller.abort()
    }
  }
}

/** 解析网易云搜索响应为内部歌曲列表。 */
export function parseSearchResponse(content: string) {
  try {
    const parsed = JSON.parse(content) as NetEaseSearchResponse
    const songs = parsed.result?.songs

    if (!Array.isArray(songs)) {
      return null
    }

    return songs.map<SongData>((song) => ({
      id: song.id,
      name: song.name,
      artists: song.artists.map((artist) => artist.name).join('/'),
      albumName: song.album.name,
      duration: song.duration
    }))
  } catch {
    return null
  }
}

/** 从 Meting API 响应中解析 HTTP 音频 URL。 */
export function parseMetingUrl(content: string) {
  const trimmed = content.trim()

  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed
    }
  } catch {
    // 继续尝试 JSON 格式。
  }

  try {
    const parsed = JSON.parse(trimmed) as { url?: unknown }

    if (typeof parsed.url !== 'string') {
      return null
    }

    const normalized = parsed.url.trim()
    const url = new URL(normalized)

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return normalized
    }
  } catch {
    return null
  }

  return null
}

function buildMetingUrl(baseUrl: string, songId: number) {
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}type=url&id=${songId}`
}

function resolveExtension(contentType: string | null) {
  if (!contentType) return '.mp3'
  if (contentType.includes('audio/mpeg')) return '.mp3'
  if (contentType.includes('audio/mp4')) return '.m4a'
  if (contentType.includes('audio/wav')) return '.wav'
  if (contentType.includes('audio/flac')) return '.flac'
  return '.mp3'
}

/** 搜索网易云音乐歌曲。 */
export async function searchNetEase(
  _config: Config,
  keyword: string,
  limit: number,
  logger: PluginLogger
) {
  const searchApiUrl = `http://music.163.com/api/search/get/web?csrf_token=hlpretag=&hlposttag=&s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=${limit}`

  return await raceRequests(
    [{ label: '网易云搜索', run: (signal) => requestText(searchApiUrl, signal) }],
    SEARCH_TIMEOUT_MS,
    parseSearchResponse,
    '网易云搜索',
    logger
  )
}

/** 通过 Meting API 解析歌曲直链。 */
export async function resolveSongSource(config: Config, songId: number, logger: PluginLogger) {
  const apis = config.sourceMode === 'custom'
    ? [config.customMetingApi]
    : PRESET_METING_APIS

  const candidates = apis.map<RequestCandidate<string>>((api) => {
    const targetUrl = buildMetingUrl(api, songId)
    return {
      label: new URL(api).host,
      run: (signal) => requestText(targetUrl, signal)
    }
  })

  return await raceRequests(candidates, SOURCE_TIMEOUT_MS, parseMetingUrl, '歌曲直链获取', logger)
}

/** 下载歌曲音频为 Buffer。 */
export async function fetchSongBuffer(targetUrl: string) {
  const controller = new AbortController()
  const disposeTimeout = createAbortTimeout(controller, DOWNLOAD_TIMEOUT_MS)

  try {
    const result = await requestArrayBuffer(targetUrl, controller.signal)
    return result.buffer
  } finally {
    disposeTimeout()
    controller.abort()
  }
}

/** 下载歌曲音频为临时文件并返回文件路径。 */
export async function downloadSongFile(targetUrl: string) {
  const controller = new AbortController()
  const disposeTimeout = createAbortTimeout(controller, DOWNLOAD_TIMEOUT_MS)

  try {
    const result = await requestArrayBuffer(targetUrl, controller.signal)
    const filename = `${crypto.randomBytes(8).toString('hex')}${resolveExtension(result.contentType)}`
    const filePath = path.join(os.tmpdir(), filename)

    await fs.writeFile(filePath, result.buffer)
    return filePath
  } finally {
    disposeTimeout()
    controller.abort()
  }
}
```

- [ ] **Step 4: Run network tests**

Run:

```bash
npm test -- tests/network.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit network module**

```bash
git add src/network.ts tests/network.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加网易云搜索和歌曲直链解析

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Song Selector

**Files:**
- Create: `tests/selector.test.ts`
- Create: `src/selector.ts`

- [ ] **Step 1: Write failing selector tests**

Write `tests/selector.test.ts`:

```ts
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
    expect(selectBestSong(songs, '周杰伦 晴天')).toEqual(songs[1])
  })

  it('falls back to the first song when nothing matches', () => {
    expect(selectBestSong(songs, '完全不存在')).toEqual(songs[0])
  })

  it('returns undefined for an empty list', () => {
    expect(selectBestSong([], '晴天')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/selector.test.ts
```

Expected: FAIL because `src/selector.ts` does not exist.

- [ ] **Step 3: Implement selector**

Write `src/selector.ts`:

```ts
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

  if (/live|伴奏|翻唱|remix/i.test(song.name)) {
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
```

- [ ] **Step 4: Run selector tests**

Run:

```bash
npm test -- tests/selector.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit selector**

```bash
git add src/selector.ts tests/selector.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加网易云候选歌曲选择策略

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Sender Module

**Files:**
- Create: `tests/sender.test.ts`
- Create: `src/sender.ts`

- [ ] **Step 1: Write failing sender tests**

Write `tests/sender.test.ts`:

```ts
// 歌曲发送模块测试
// 验证三种发送模式会生成对应 Koishi 消息元素

import { h, type Session } from 'koishi'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../src/types'
import { sendGenerationTip, sendSongByMode } from '../src/sender'
import { downloadSongFile, fetchSongBuffer } from '../src/network'

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
  return {
    send: vi.fn(async () => ['message-id'])
  } as unknown as Session & { send: ReturnType<typeof vi.fn> }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('sendGenerationTip', () => {
  it('sends no message for empty tip', async () => {
    const session = createSession()

    await sendGenerationTip(session, '   ')

    expect(session.send).not.toHaveBeenCalled()
  })

  it('sends a text tip when configured', async () => {
    const session = createSession()

    await sendGenerationTip(session, '正在找歌…')

    expect(String(session.send.mock.calls[0][0])).toContain('正在找歌')
  })
})

describe('sendSongByMode', () => {
  it('sends remote audio URL in audio-url mode', async () => {
    const session = createSession()

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', baseConfig)

    const audio = h.select(session.send.mock.calls[0][0], 'audio')
    expect(audio[0].attrs.url).toBe('https://cdn.example.com/song.mp3')
  })

  it('downloads and sends buffer in audio-buffer mode', async () => {
    const session = createSession()
    vi.mocked(fetchSongBuffer).mockResolvedValue(Buffer.from([1, 2, 3]))

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', {
      ...baseConfig,
      sendMode: 'audio-buffer'
    })

    expect(fetchSongBuffer).toHaveBeenCalledWith('https://cdn.example.com/song.mp3')
    const audio = h.select(session.send.mock.calls[0][0], 'audio')
    expect(audio[0].attrs.type).toBe('audio/mpeg')
  })

  it('downloads and sends file in file mode', async () => {
    const session = createSession()
    vi.mocked(downloadSongFile).mockResolvedValue('/tmp/chatluna-music-song.mp3')

    await sendSongByMode(session, 'https://cdn.example.com/song.mp3', {
      ...baseConfig,
      sendMode: 'file'
    })

    expect(downloadSongFile).toHaveBeenCalledWith('https://cdn.example.com/song.mp3')
    const file = h.select(session.send.mock.calls[0][0], 'file')
    expect(file[0].attrs.url).toBe('file:///tmp/chatluna-music-song.mp3')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/sender.test.ts
```

Expected: FAIL because `src/sender.ts` does not exist.

- [ ] **Step 3: Implement sender**

Write `src/sender.ts`:

```ts
// 歌曲发送模块
// 根据配置把歌曲直链发送为音频 URL、音频 buffer 或文件

import { promises as fs } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { h, type Session } from 'koishi'

import { downloadSongFile, fetchSongBuffer } from './network'
import type { Config } from './types'

/** 按配置发送生成提示。 */
export async function sendGenerationTip(session: Session, tip: string) {
  const normalized = tip.trim()

  if (!normalized) {
    return
  }

  await session.send(h.text(normalized))
}

/** 按配置发送歌曲。 */
export async function sendSongByMode(session: Session, src: string, config: Config) {
  switch (config.sendMode) {
    case 'audio-url':
      await session.send(h.audio(src))
      return
    case 'audio-buffer': {
      const buffer = await fetchSongBuffer(src)
      await session.send(h.audio(buffer, 'audio/mpeg'))
      return
    }
    case 'file': {
      const tempFilePath = await downloadSongFile(src)

      try {
        await session.send(h.file(pathToFileURL(tempFilePath).href))
      } finally {
        await fs.unlink(tempFilePath).catch(() => {})
      }
    }
  }
}
```

- [ ] **Step 4: Run sender tests**

Run:

```bash
npm test -- tests/sender.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit sender**

```bash
git add src/sender.ts tests/sender.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加歌曲语音发送模式

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Player Orchestration

**Files:**
- Create: `tests/player.test.ts`
- Create: `src/player.ts`

- [ ] **Step 1: Write failing player tests**

Write `tests/player.test.ts`:

```ts
// 音乐播放主流程测试
// 验证搜索、选歌、解析直链和发送的编排结果

import type { Session } from 'koishi'
import { describe, expect, it, vi } from 'vitest'

import type { Config, PluginLogger, SongData } from '../src/types'
import { playNeteaseMusic } from '../src/player'

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const config: Config = {
  toolName: 'play_netease_music_as_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

const session = {} as Session

const song: SongData = {
  id: 186016,
  name: '晴天',
  artists: '周杰伦',
  albumName: '叶惠美',
  duration: 269000
}

describe('playNeteaseMusic', () => {
  it('searches, resolves, sends and returns success text', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    }

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('已发送：晴天 - 周杰伦')

    expect(deps.search).toHaveBeenCalledWith(config, '晴天', 5, logger)
    expect(deps.resolveSource).toHaveBeenCalledWith(config, 186016, logger)
    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/song.mp3', config)
  })

  it('returns not found when search has no result', async () => {
    const deps = {
      search: vi.fn(async () => []),
      select: vi.fn(),
      resolveSource: vi.fn(),
      sendTip: vi.fn(),
      send: vi.fn()
    }

    await expect(playNeteaseMusic(session, config, '不存在的歌', logger, deps))
      .resolves.toBe('没有找到合适歌曲。')

    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns source failure text when URL resolving fails', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => { throw new Error('source failed') }),
      sendTip: vi.fn(),
      send: vi.fn()
    }

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('找到了歌曲，但暂时无法获取播放地址。')

    expect(deps.send).not.toHaveBeenCalled()
  })

  it('returns send failure text when message sending fails', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => { throw new Error('send failed') })
    }

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('找到了歌曲，但语音发送失败。')
  })

  it('returns service unavailable when search throws', async () => {
    const deps = {
      search: vi.fn(async () => { throw new Error('network failed') }),
      select: vi.fn(),
      resolveSource: vi.fn(),
      sendTip: vi.fn(),
      send: vi.fn()
    }

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe('音乐服务暂时不可用。')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/player.test.ts
```

Expected: FAIL because `src/player.ts` does not exist.

- [ ] **Step 3: Implement player orchestration**

Write `src/player.ts`:

```ts
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
```

- [ ] **Step 4: Run player tests**

Run:

```bash
npm test -- tests/player.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all current tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit player**

```bash
git add src/player.ts tests/player.test.ts
git commit -m "$(cat <<'EOF'
feat: 串联音乐搜索和语音发送流程

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: ChatLuna Tool Registration

**Files:**
- Create: `tests/tool.test.ts`
- Create: `src/tool.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing tool tests**

Write `tests/tool.test.ts`:

```ts
// ChatLuna 工具注册测试
// 验证工具注册、query 输入和当前 session 读取

import type { Context, Session } from 'koishi'
import { describe, expect, it, vi } from 'vitest'

import type { Config, PluginLogger } from '../src/types'
import { ChatLunaMusicTool, registerChatLunaMusicTool } from '../src/tool'

const config: Config = {
  toolName: 'play_netease_music_as_voice',
  searchLimit: 5,
  sourceMode: 'preset',
  customMetingApi: 'https://example.com/meting/',
  sendMode: 'audio-url',
  generationTip: '',
  debug: false
}

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('ChatLunaMusicTool', () => {
  it('returns a session error when current session is missing', async () => {
    const tool = new ChatLunaMusicTool(config, logger, vi.fn())

    await expect(tool._call({ query: '晴天' })).resolves.toBe('音乐工具无法获取当前会话。')
  })

  it('passes query and session to play function', async () => {
    const session = { userId: '10001' } as Session
    const play = vi.fn(async () => '已发送：晴天 - 周杰伦')
    const tool = new ChatLunaMusicTool(config, logger, play)

    await expect(tool._call({ query: '晴天' }, undefined, {
      configurable: { session }
    })).resolves.toBe('已发送：晴天 - 周杰伦')

    expect(play).toHaveBeenCalledWith(session, config, '晴天', logger)
  })
})

describe('registerChatLunaMusicTool', () => {
  it('registers a ChatLuna platform tool and returns dispose function', () => {
    const dispose = vi.fn()
    const registerTool = vi.fn(() => dispose)
    const on = vi.fn()
    const ctx = {
      chatluna: {
        platform: { registerTool }
      },
      on
    } as unknown as Context

    const result = registerChatLunaMusicTool(ctx, config, logger)

    expect(result).toBe(dispose)
    expect(registerTool).toHaveBeenCalledWith('play_netease_music_as_voice', expect.objectContaining({
      createTool: expect.any(Function),
      selector: expect.any(Function)
    }))
    expect(on).toHaveBeenCalledWith('dispose', dispose)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/tool.test.ts
```

Expected: FAIL because `src/tool.ts` does not exist.

- [ ] **Step 3: Implement ChatLuna tool**

Write `src/tool.ts`:

```ts
// ChatLuna 工具注册模块
// 把网易云音乐播放能力暴露给 ChatLuna 工具调用系统

import type {} from 'koishi-plugin-chatluna/services/chat'

import type { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager'
import type { RunnableConfig } from '@langchain/core/runnables'
import { StructuredTool } from '@langchain/core/tools'
import type { Context, Session } from 'koishi'
import { z } from 'zod'

import { DEFAULT_TOOL_NAME } from './constants'
import { playNeteaseMusic } from './player'
import type { Config, MusicToolInput, PluginLogger } from './types'

export type PlayMusicFunction = (
  session: Session,
  config: Config,
  query: string,
  logger: PluginLogger
) => Promise<string>

/** ChatLuna 网易云音乐语音工具。 */
export class ChatLunaMusicTool extends StructuredTool {
  name: string
  description = 'Search NetEase Music with a query and send the selected full song as an audio or voice message in the current chat. Use this when the conversation naturally calls for playing music. The only input is query.'
  schema = z.object({
    query: z.string().min(1).describe('Song name, artist name, style, or natural language music search query.')
  })

  constructor(
    private config: Config,
    private logger: PluginLogger,
    private playMusic: PlayMusicFunction = playNeteaseMusic
  ) {
    super()
    this.name = config.toolName.trim() || DEFAULT_TOOL_NAME
  }

  /** 执行音乐搜索并发送歌曲。 */
  async _call(
    input: MusicToolInput,
    _runManager?: CallbackManagerForToolRun,
    runConfig?: RunnableConfig
  ) {
    const session = runConfig?.configurable?.session as Session | undefined

    if (!session) {
      return '音乐工具无法获取当前会话。'
    }

    return await this.playMusic(session, this.config, input.query, this.logger)
  }
}

/** 注册 ChatLuna 音乐工具并返回注销函数。 */
export function registerChatLunaMusicTool(ctx: Context, config: Config, logger: PluginLogger) {
  const toolName = config.toolName.trim() || DEFAULT_TOOL_NAME
  const dispose = ctx.chatluna.platform.registerTool(toolName, {
    createTool() {
      return new ChatLunaMusicTool({ ...config, toolName }, logger)
    },
    selector() {
      return true
    }
  })

  ctx.on('dispose', dispose)
  logger.info('已注册 ChatLuna 音乐工具', toolName)
  return dispose
}
```

- [ ] **Step 4: Wire tool registration in entry**

Replace `src/index.ts` with:

```ts
// ChatLuna 音乐语音工具插件入口
// 负责声明 Koishi 插件依赖并注册 ChatLuna 工具

import type {} from 'koishi-plugin-chatluna/services/chat'

import type { Context } from 'koishi'

import { Config } from './config'
import { createPluginLogger } from './logger'
import { registerChatLunaMusicTool } from './tool'
import type { Config as PluginConfig } from './types'

export const name = 'chatluna-music'

export const inject = {
  required: ['chatluna']
}

export { Config }

/** 注册 ChatLuna 音乐工具。 */
export function apply(ctx: Context, config: PluginConfig) {
  const logger = createPluginLogger(ctx, config)
  registerChatLunaMusicTool(ctx, config, logger)
}
```

- [ ] **Step 5: Run tool tests**

Run:

```bash
npm test -- tests/tool.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run all tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit ChatLuna tool**

```bash
git add src/tool.ts src/index.ts tests/tool.test.ts
git commit -m "$(cat <<'EOF'
feat: 注册 ChatLuna 音乐语音工具

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Final Build and Manual Verification Notes

**Files:**
- Modify only files needed to fix test, type, or build failures found in this task.

- [ ] **Step 1: Run full validation**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Inspect package output**

Run:

```bash
ls lib
```

Expected: compiled `.js`, `.d.ts`, and `.js.map` files exist for the created `src/` modules.

- [ ] **Step 3: Check git state**

Run:

```bash
git status --short
```

Expected: no uncommitted changes. If build outputs are untracked because `lib/` is not ignored, leave them uncommitted unless the package policy requires committing build output.

- [ ] **Step 4: Record manual verification checklist in the implementation summary**

When reporting completion, include this manual verification checklist for the user to run in Koishi:

```text
1. 安装并启用 koishi-plugin-chatluna、chatluna-character 和本插件。
2. 确认 chatluna-character 对应会话开启 toolCalling。
3. 本插件保持默认 toolName=play_netease_music_as_voice，sendMode 先用 audio-url。
4. 在群聊或私聊中自然表达想听歌，例如“今天好累，想听点周杰伦”。
5. 检查角色是否调用工具，并确认 QQ / OneBot 是否收到音频。
6. 如果 audio-url 失败，把 sendMode 改成 audio-buffer 后重试。
7. 如果仍失败，收集 Koishi 日志中的“歌曲语音发送失败”或“OneBot 发送失败”信息。
```

- [ ] **Step 5: Commit final fixes if any files changed**

If Step 1 or Step 2 required code changes, commit them:

```bash
git add src tests package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "$(cat <<'EOF'
fix: 完成音乐语音工具验证修正

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If no files changed, do not create an empty commit.

---

## Plan Self-Review

Spec coverage:

- 独立 Koishi 插件：Task 1、Task 2、Task 7。
- 不修改 `chatluna-character`：所有任务只创建本仓库文件。
- 注册 ChatLuna 工具：Task 7。
- 工具输入只保留 `query`：Task 2 类型、Task 7 schema 和测试。
- 网易云搜索：Task 3。
- 自动选歌：Task 4。
- Meting API 直链解析：Task 3。
- `audio-url`、`audio-buffer`、`file` 三种发送模式：Task 5。
- 失败文本：Task 6。
- 类型检查、构建、测试：Task 1、Task 3 到 Task 8。

Placeholder scan:

- 本计划没有未展开的实现描述或空白步骤。

Type consistency:

- 配置类型统一使用 `Config`。
- 发送模式统一使用 `audio-url`、`audio-buffer`、`file`。
- 工具输入统一使用 `MusicToolInput`，只包含 `query`。
- 主流程函数统一为 `playNeteaseMusic(session, config, query, logger, deps?)`。
