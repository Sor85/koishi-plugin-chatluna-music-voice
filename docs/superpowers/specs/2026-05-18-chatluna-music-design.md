# ChatLuna 音乐语音工具插件设计

## 背景

本项目是一个 Koishi 插件，目标是为 `chatluna-character` 提供一个独立的 ChatLuna 工具，让 AI 在自然聊天中自主查询网易云音乐，并把选中的整首歌作为语音或音频消息发送到当前会话，主要面向 OneBot / QQ 场景。

外部参考源码包括：

- `chatluna-character`：通过 ChatLuna 工具调用驱动角色回复，能够从 ChatLuna 平台工具列表中取得可用工具。
- `koishi-plugin-music-voice`：已有网易云搜索、Meting API 直链解析和多种音频发送模式，可作为音乐检索与发送流程参考。

## 目标

- 提供一个独立 Koishi 插件，不修改 `chatluna-character` 源码。
- 注册一个 ChatLuna 工具，让 AI 可以在自然聊天中自主决定是否调用。
- 第一版只支持网易云音乐。
- `searchLimit = 1` 时，工具搜索到一首歌后直接解析直链并发送整首歌。
- `searchLimit > 1` 时，工具先返回候选歌单，不直接发送；AI 选择序号后再次调用工具播放对应歌曲。
- 发送方式可配置，默认优先使用直链音频发送。
- 失败时返回简短可理解的工具结果，并在日志中记录详细错误。

## 非目标

- 不做多音乐平台搜索。
- 不实现翻页、QQ Markdown 按钮等命令式交互。
- 不修改 `chatluna-character` 或 `music-voice` 的源码。
- 不在第一版内置 ffmpeg / silk 转码流程。
- 不做冷却、白名单、时长限制或防刷限制。
- 不保存跨轮次候选歌单状态；AI 二次选择时通过同一个 `query` 重新搜索并按序号播放。

## 总体架构

插件启动时注册一个 ChatLuna 工具，默认名称为 `play_netease_music_as_voice`。当 `chatluna-character` 开启工具调用后，角色模型可以在对话中看到这个工具，并根据聊天上下文自主决定是否调用。

工具调用链路：

1. AI 根据聊天上下文决定需要放歌。
2. AI 调用 `play_netease_music_as_voice` 并传入搜索关键词。
3. 插件查询网易云音乐搜索接口，返回数量由 Koishi 配置项 `searchLimit` 控制。
4. 如果 `searchLimit = 1`，插件直接使用唯一候选，解析直链并发送歌曲。
5. 如果 `searchLimit > 1` 且本次没有传入 `index`，插件返回候选歌单给 AI，不解析直链、不发送歌曲。
6. AI 根据候选歌单选择序号，再次调用工具并传入同一个 `query` 和 `index`。
7. 插件重新搜索同一个 `query`，按 `index` 选择歌曲，解析直链并发送。
8. 插件返回“已发送 / 未找到 / 序号无效 / 获取失败 / 发送失败”等结果文本给 AI。

这种设计保持插件独立，避免升级 `chatluna-character` 时发生源码冲突，也避免让 AI 去模拟用户执行 `music` 命令。

## ChatLuna 工具设计

工具输入：

- `query`：必填。歌曲、歌手、风格或自然语言搜索关键词，例如“周杰伦 晴天”“适合失眠听的歌”。
- `index`：可选。候选歌单中的序号，从 1 开始。AI 只有在已经拿到候选歌单并决定播放某一首时才传入。

工具描述需要明确告诉 AI：

- 当工具返回候选歌单时，不代表歌曲已发送。
- 如果要播放候选歌单中的某首歌，需要再次调用工具，并传入候选项对应的 `index`。
- 第二次调用应保持同一个 `query`，避免重新搜索后候选顺序发生不必要变化。

## 候选歌单与选歌策略

`searchLimit` 是前端配置项，含义是每次搜索返回的候选歌曲数量。

- `searchLimit = 1`：只返回 1 首候选歌曲，没有必要让 AI 再选，插件直接发送。
- `searchLimit > 1` 且未传入 `index`：插件把搜索结果格式化为候选歌单返回给 AI。
- `searchLimit > 1` 且传入 `index`：插件选择搜索结果中的第 `index` 首歌曲并发送。

候选歌单格式固定为简短文本，例如：

```text
找到以下候选歌曲：
1. 晴天 - 周杰伦（叶惠美）
2. 晴天 Live - 周杰伦（演唱会）
3. 晴天 - 其他歌手（翻唱专辑）

请根据用户想听的歌曲，再次调用本工具并传入对应 index。
```

如果 `index` 小于 1 或大于实际候选数量，工具返回：

```text
序号无效，请选择 1-3 之间的数字。
```

## 音乐检索与直链解析

网易云搜索参考 `music-voice` 的实现方式：

- 使用网易云 Web 搜索接口获取歌曲候选。
- 将返回结果转换为内部 `SongData`：歌曲 ID、歌曲名、歌手、专辑、时长。
- 通过预设 Meting API 列表或自定义 Meting API 获取播放直链。
- 多个 API 使用竞速请求，优先采用第一个可用结果。
- Meting API 返回纯 URL、JSON URL 或直接音频响应时都应能解析为可播放来源。

## 发送模式

配置项 `sendMode` 控制发送方式：

- `audio-url`：默认。直接通过 Koishi `h.audio(url)` 发送音频 URL。
- `audio-buffer`：下载音频内容后，通过 Koishi `h.audio(buffer, 'audio/mpeg')` 发送。
- `file`：下载临时文件后发送文件，主要作为兜底模式，不完全等同于语音消息。

第一版不内置转码。QQ / OneBot 是否能把整首歌成功作为语音发送，取决于实际 OneBot 实现和协议端能力。如果默认模式不稳定，再在后续版本增加 ffmpeg / silk 转码模式。

## 配置项

- `toolName`：ChatLuna 工具名，默认 `play_netease_music_as_voice`。
- `searchLimit`：搜索候选数量，默认 `5`。设置为 `1` 时工具直接发送唯一候选；大于 `1` 时工具先返回候选歌单。
- `sourceMode`：直链 API 来源，支持 `preset` 和 `custom`，默认 `preset`。
- `customMetingApi`：自定义 Meting API 地址，仅在 `sourceMode = custom` 时使用。
- `sendMode`：发送方式，默认 `audio-url`。
- `generationTip`：发送前提示，默认空字符串，不额外刷提示消息。
- `debug`：是否输出详细调试日志，默认关闭。

## 错误处理

工具失败时不向用户暴露堆栈，只返回简短工具结果：

- 搜不到歌：`没有找到合适歌曲。`
- 候选序号无效：`序号无效，请选择 1-N 之间的数字。`
- 直链解析失败：`找到了歌曲，但暂时无法获取播放地址。`
- 发送失败：`找到了歌曲，但语音发送失败。`
- 网络超时：`音乐服务暂时不可用。`

详细错误写入 Koishi 日志，方便排查 Meting API、网易云接口、OneBot 发送失败等问题。

## 风险

- AI 自主调用且不做防刷限制，可能在群聊中频繁发送整首歌。
- 整首歌文件较大，`audio-buffer` 模式可能较慢，也可能触发平台发送限制。
- `audio-url` 模式最简单，但不同 OneBot 实现对远程音频 URL 的兼容性不同。
- Meting API 依赖第三方服务，可用性不稳定。
- 二次选择会重新搜索同一个 `query`，如果网易云搜索排序变化，候选顺序可能变化；第一版接受这个风险，不引入状态缓存。

这些风险在第一版接受，不额外实现限制逻辑。

## 测试计划

单元测试：

- 网易云搜索响应能转换为内部歌曲数据。
- Meting API 返回纯 URL、JSON URL 或直接音频响应时都能解析。
- `searchLimit = 1` 时工具会直接解析并发送唯一候选。
- `searchLimit > 1` 且未传入 `index` 时工具返回候选歌单且不发送消息。
- `searchLimit > 1` 且传入有效 `index` 时工具发送对应序号歌曲。
- `index` 越界时工具返回序号无效提示且不发送消息。
- 搜不到歌时工具返回失败文本且不发送消息。
- `audio-url`、`audio-buffer`、`file` 三种发送模式会调用对应 Koishi 元素。

构建验证：

- TypeScript 类型检查通过。
- 插件包结构能被 Koishi 识别。

手动验证：

- 在 Koishi + ChatLuna + chatluna-character 环境中启用工具调用。
- 设置 `searchLimit = 1`，在自然聊天中让角色判断需要放歌，确认直接收到整首歌音频。
- 设置 `searchLimit = 5`，让角色搜歌，确认工具先返回候选歌单。
- 让角色根据候选歌单传入 `index` 再次调用工具，确认 OneBot / QQ 会话中收到对应歌曲。

## 验收标准

- 插件不修改 `chatluna-character` 源码。
- 插件能注册 ChatLuna 工具。
- AI 能通过工具自主触发网易云搜歌。
- `searchLimit = 1` 时插件能直接发送唯一候选整首歌。
- `searchLimit > 1` 时插件能返回候选歌单，并支持 AI 用 `index` 选择播放。
- 失败不会导致角色回复流程崩溃，并会返回可理解的失败文本。
