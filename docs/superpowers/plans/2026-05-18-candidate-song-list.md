# Candidate Song List Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the ChatLuna music tool so `searchLimit = 1` sends directly, while `searchLimit > 1` returns a numbered candidate list and supports a second call with `index` to play the selected song.

**Architecture:** Keep the existing single ChatLuna tool and player pipeline. Extend `MusicToolInput` and the LangChain schema with optional `index`, then move candidate-list branching into `playNeteaseMusic()` so network search, source resolving, and sending remain centralized.

**Tech Stack:** TypeScript, Koishi, ChatLuna tool registration, LangChain `StructuredTool`, Zod v3, Vitest.

---

## File Structure

- Modify `src/types.ts`: add `index?: number` to `MusicToolInput`.
- Modify `src/tool.ts`: extend tool schema and pass `input.index` to the player function.
- Modify `src/player.ts`: add candidate list formatting, `index` selection, and `searchLimit = 1` direct-send behavior.
- Modify `tests/tool.test.ts`: assert the tool accepts and forwards `index`.
- Modify `tests/player.test.ts`: cover candidate list, direct send, index send, and invalid index.

---

### Task 1: Extend Tool Input with `index`

**Files:**
- Modify: `src/types.ts`
- Modify: `src/tool.ts`
- Test: `tests/tool.test.ts`

- [ ] **Step 1: Update the tool test to require forwarding `index`**

Edit `tests/tool.test.ts` and replace the second `ChatLunaMusicTool` test with this version:

```ts
  it('passes query, index and session to play function', async () => {
    const session = { userId: '10001' } as Session
    const play = vi.fn(async () => '已发送：晴天 - 周杰伦')
    const tool = new ChatLunaMusicTool(config, logger, play)

    await expect(
      tool._call({ query: '晴天', index: 2 }, undefined, {
        configurable: { session }
      })
    ).resolves.toBe('已发送：晴天 - 周杰伦')

    expect(play).toHaveBeenCalledWith(session, config, '晴天', logger, 2)
  })
```

- [ ] **Step 2: Run the focused tool test and verify it fails**

Run:

```bash
npm test -- tests/tool.test.ts
```

Expected: FAIL because `MusicToolInput` does not allow `index`, and `PlayMusicFunction` / `_call()` do not forward a fifth argument.

- [ ] **Step 3: Update `MusicToolInput`**

Edit `src/types.ts` and replace the interface with:

```ts
export interface MusicToolInput {
  query: string
  index?: number
}
```

- [ ] **Step 4: Update `PlayMusicFunction` and the Zod schema**

Edit `src/tool.ts`.

Replace the schema block with:

```ts
const musicToolSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Song name, artist name, style, or natural language music search query.'),
  index: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Candidate song number from the previous result list, starting from 1.')
})
```

Replace `PlayMusicFunction` with:

```ts
/** 搜索并发送网易云音乐的实际执行函数签名。 */
export type PlayMusicFunction = (
  session: Session,
  config: Config,
  query: string,
  logger: PluginLogger,
  index?: number
) => Promise<string>
```

Replace the return line inside `_call()` with:

```ts
    return await this.playMusic(session, this.config, input.query, this.logger, input.index)
```

- [ ] **Step 5: Update the tool description**

In `src/tool.ts`, replace the `description` string with:

```ts
  description =
    'Search NetEase Music with a query. If the tool returns a numbered candidate list, call it again with the same query and the chosen index to send that full song as audio or voice in the current chat. Input is query and optional index.'
```

- [ ] **Step 6: Verify the tool test passes**

Run:

```bash
npm test -- tests/tool.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add src/types.ts src/tool.ts tests/tool.test.ts
git commit -m "$(cat <<'EOF'
feat: 支持音乐工具序号输入

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add Candidate List Branching in Player

**Files:**
- Modify: `src/player.ts`
- Test: `tests/player.test.ts`

- [ ] **Step 1: Update the success test for `searchLimit = 1`**

In `tests/player.test.ts`, replace the first test body with:

```ts
  it('sends the only candidate directly when searchLimit is 1', async () => {
    const singleConfig = { ...config, searchLimit: 1 }
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, singleConfig, '晴天', logger, deps))
      .resolves.toBe('已发送：晴天 - 周杰伦')

    expect(deps.search).toHaveBeenCalledWith(singleConfig, '晴天', 1, logger)
    expect(deps.select).not.toHaveBeenCalled()
    expect(deps.resolveSource).toHaveBeenCalledWith(singleConfig, 186016, logger)
    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/song.mp3', singleConfig)
  })
```

- [ ] **Step 2: Add a candidate list test**

In `tests/player.test.ts`, after the direct-send test, add:

```ts
  it('returns candidate list without sending when searchLimit is greater than 1 and index is missing', async () => {
    const anotherSong: SongData = {
      id: 2,
      name: '晴天 Live',
      artists: '周杰伦',
      albumName: '演唱会',
      duration: 280000
    }
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, deps))
      .resolves.toBe([
        '找到以下候选歌曲：',
        '1. 晴天 - 周杰伦（叶惠美）',
        '2. 晴天 Live - 周杰伦（演唱会）',
        '',
        '请根据用户想听的歌曲，再次调用本工具并传入对应 index。'
      ].join('\n'))

    expect(deps.select).not.toHaveBeenCalled()
    expect(deps.resolveSource).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })
```

- [ ] **Step 3: Add an indexed send test**

In `tests/player.test.ts`, after the candidate list test, add:

```ts
  it('sends the selected candidate when index is provided', async () => {
    const anotherSong: SongData = {
      id: 2,
      name: '晴天 Live',
      artists: '周杰伦',
      albumName: '演唱会',
      duration: 280000
    }
    const deps = {
      search: vi.fn(async () => [song, anotherSong]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/live.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 2, deps))
      .resolves.toBe('已发送：晴天 Live - 周杰伦')

    expect(deps.select).not.toHaveBeenCalled()
    expect(deps.resolveSource).toHaveBeenCalledWith(config, 2, logger)
    expect(deps.send).toHaveBeenCalledWith(session, 'https://cdn.example.com/live.mp3', config)
  })
```

- [ ] **Step 4: Add an invalid index test**

In `tests/player.test.ts`, after the indexed send test, add:

```ts
  it('returns invalid index text without sending when index is out of range', async () => {
    const deps = {
      search: vi.fn(async () => [song]),
      select: vi.fn(() => song),
      resolveSource: vi.fn(async () => 'https://cdn.example.com/song.mp3'),
      sendTip: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined)
    } satisfies PlayNeteaseMusicDependencies

    await expect(playNeteaseMusic(session, config, '晴天', logger, 2, deps))
      .resolves.toBe('序号无效，请选择 1-1 之间的数字。')

    expect(deps.select).not.toHaveBeenCalled()
    expect(deps.resolveSource).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })
```

- [ ] **Step 5: Run focused player tests and verify they fail**

Run:

```bash
npm test -- tests/player.test.ts
```

Expected: FAIL because `playNeteaseMusic()` does not accept `index`, still uses `selectBestSong()`, and does not format candidate lists.

- [ ] **Step 6: Add candidate list formatting helper**

Edit `src/player.ts`. After `defaultDependencies`, add:

```ts
function formatCandidateList(songs: SongData[]) {
  return [
    '找到以下候选歌曲：',
    ...songs.map((song, index) => `${index + 1}. ${song.name} - ${song.artists}（${song.albumName}）`),
    '',
    '请根据用户想听的歌曲，再次调用本工具并传入对应 index。'
  ].join('\n')
}
```

- [ ] **Step 7: Extract sending selected song into a helper**

Still in `src/player.ts`, after `formatCandidateList`, add:

```ts
async function sendSelectedSong(
  session: Session,
  config: Config,
  selected: SongData,
  logger: PluginLogger,
  deps: PlayNeteaseMusicDependencies
) {
  let src: string

  try {
    src = await deps.resolveSource(config, selected.id, logger)
  } catch (error) {
    logger.warn('歌曲直链获取失败', error)
    return '找到了歌曲，但暂时无法获取播放地址。'
  }

  try {
    await deps.sendTip(session, config.generationTip)
  } catch (error) {
    logger.warn('生成提示发送失败', error)
  }

  try {
    await deps.send(session, src, config)
  } catch (error) {
    logger.error('歌曲语音发送失败', error)
    return '找到了歌曲，但语音发送失败。'
  }

  logger.info('已发送歌曲', `${selected.name} - ${selected.artists}`)
  return `已发送：${selected.name} - ${selected.artists}`
}
```

- [ ] **Step 8: Update `playNeteaseMusic()` signature and branching**

In `src/player.ts`, replace the whole `playNeteaseMusic()` function with:

```ts
/** 搜索网易云音乐，并根据候选数量返回歌单或发送指定歌曲。 */
export async function playNeteaseMusic(
  session: Session,
  config: Config,
  query: string,
  logger: PluginLogger,
  index?: number,
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

  if (config.searchLimit > 1) {
    if (index === undefined) {
      return formatCandidateList(songs)
    }

    const selected = songs[index - 1]

    if (!selected) {
      return `序号无效，请选择 1-${songs.length} 之间的数字。`
    }

    return await sendSelectedSong(session, config, selected, logger, deps)
  }

  return await sendSelectedSong(session, config, songs[0], logger, deps)
}
```

- [ ] **Step 9: Run focused player tests**

Run:

```bash
npm test -- tests/player.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

Run:

```bash
git add src/player.ts tests/player.test.ts
git commit -m "$(cat <<'EOF'
feat: 返回候选歌单并支持序号播放

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Final Validation

**Files:**
- Modify only files needed to fix validation failures.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS. All current tests should pass, including tool, player, network, sender, and selector tests.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS and `lib/src/tool.js`, `lib/src/player.js`, and declaration files are generated.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: no unstaged or uncommitted tracked changes after commits. Untracked `.claude/` may exist locally and should not be committed.

- [ ] **Step 5: Manual verification notes**

Report these manual checks to the user:

```text
手动验证建议：
1. 设置 searchLimit = 1，让 AI 调用工具，确认直接收到整首歌。
2. 设置 searchLimit = 5，让 AI 调用工具，确认工具返回候选歌单且不发送。
3. 让 AI 使用同一个 query 和 index 再次调用工具，确认发送对应序号歌曲。
4. 让 AI 传入越界 index，确认返回“序号无效，请选择 1-N 之间的数字。”。
```

- [ ] **Step 6: Commit any validation fix if needed**

Only if validation required code changes, commit them with:

```bash
git add <changed-files>
git commit -m "$(cat <<'EOF'
fix: 完善候选歌单选择验证

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If validation passes without changes, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers `index?: number`, `searchLimit = 1` direct send, `searchLimit > 1` candidate list, valid index send, invalid index text, tests, typecheck, build, and manual verification.
- Placeholder scan: No placeholder markers are present.
- Type consistency: `MusicToolInput.index`, `PlayMusicFunction` fifth parameter, `ChatLunaMusicTool._call()`, and `playNeteaseMusic(..., index?)` all use the same optional number semantics.
