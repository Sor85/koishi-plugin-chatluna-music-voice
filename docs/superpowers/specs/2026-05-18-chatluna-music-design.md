# ChatLuna 音乐语音工具插件设计

## 背景

本项目是一个新的 Koishi 插件，目标是为 `chatluna-character` 提供一个独立的 ChatLuna 工具，让 AI 在自然聊天中自主查询网易云音乐，并把选中的整首歌作为语音或音频消息发送到当前会话，主要面向 OneBot / QQ 场景。

当前仓库基本为空。外部参考源码包括：

- `chatluna-character`：通过 ChatLuna 工具调用驱动角色回复，能够从 ChatLuna 平台工具列表中取得可用工具。
- `koishi-plugin-music-voice`：已有网易云搜索、Meting API 直链解析和多种音频发送模式，可作为音乐检索与发送流程参考。

## 目标

- 提供一个独立 Koishi 插件，不修改 `chatluna-character` 源码。
- 注册一个 ChatLuna 工具，让 AI 可以在自然聊天中自主决定是否调用。
- 第一版只支持网易云音乐。
- AI 调用工具后，插件自动搜索、选歌、解析直链并发送整首歌。
- 发送方式可配置，默认优先使用直链音频发送。
- 失败时返回简短可理解的工具结果，并在日志中记录详细错误。

## 非目标

- 不做多音乐平台搜索。
- 不实现歌单菜单、翻页、QQ Markdown 按钮等命令式交互。
- 不修改 `chatluna-character` 或 `music-voice` 的源码。
- 不在第一版内置 ffmpeg / silk 转码流程。
- 不做冷却、白名单、时长限制或防刷限制。

## 总体架构

插件启动时注册一个 ChatLuna 工具，默认名称为 `play_netease_music_as_voice`。当 `chatluna-character` 开启工具调用后，角色模型可以在对话中看到这个工具，并根据聊天上下文自主决定是否调用。

工具调用链路：

1. AI 根据聊天上下文决定需要放歌。
2. AI 调用 `play_netease_music_as_voice` 并传入搜索关键词和调用原因。
3. 插件查询网易云音乐搜索接口。
4. 插件从候选结果中选择最匹配的一首。
5. 插件通过 Meting API 获取歌曲直链。
6. 插件按配置把歌曲发送到当前 Koishi 会话。
7. 插件返回“已发送 / 未找到 / 获取失败 / 发送失败”等结果文本给 AI。

这种设计保持插件独立，避免升级 `chatluna-character` 时发生源码冲突，也避免让 AI 去模拟用户执行 `music` 命令。

## ChatLuna 工具设计

工具输入：

- `query`：必填。歌曲、歌手、风格或自然语言搜索关键词，例如“周杰伦 晴天”“适合失眠听的歌”。
- `reason`：必填。AI 为什么要播放这首歌，用于日志和工具调用说明。
- `selection_hint`：可选。选歌偏好，例如“原唱”“女声”“轻快”“伤感”“不要 live 版”。

第一版使用单工具完成搜索和发送，不拆成 `search_music` 与 `send_music` 两个工具。这样 AI 一次调用就能完成放歌，降低“只搜索不发送”的概率。

## 选歌策略

工具默认搜索前 5 条结果，并用简单规则选出一首：

1. 优先选择歌名或歌手与 `query`、`selection_hint` 明显匹配的结果。
2. 如果没有明确匹配，选择搜索结果第一首。
3. 搜不到结果时，不发送消息，返回失败文本。

该策略不追求复杂推荐算法，优先保证第一版稳定可用。未来如果需要更高自主性，可以拆成两阶段工具，让 AI 先查看候选再选择发送。

## 音乐检索与直链解析

网易云搜索参考 `music-voice` 的实现方式：

- 使用网易云 Web 搜索接口获取歌曲候选。
- 将返回结果转换为内部 `SongData`：歌曲 ID、歌曲名、歌手、专辑、时长。
- 通过预设 Meting API 列表或自定义 Meting API 获取播放直链。
- 多个 API 使用竞速请求，优先采用第一个可用结果。

## 发送模式

配置项 `sendMode` 控制发送方式：

- `audio-url`：默认。直接通过 Koishi `h.audio(url)` 发送音频 URL。
- `audio-buffer`：下载音频内容后，通过 Koishi `h.audio(buffer, 'audio/mpeg')` 发送。
- `file`：下载临时文件后发送文件，主要作为兜底模式，不完全等同于语音消息。

第一版不内置转码。QQ / OneBot 是否能把整首歌成功作为语音发送，取决于实际 OneBot 实现和协议端能力。如果默认模式不稳定，再在后续版本增加 ffmpeg / silk 转码模式。

## 配置项

- `toolName`：ChatLuna 工具名，默认 `play_netease_music_as_voice`。
- `searchLimit`：搜索候选数量，默认 `5`。
- `sourceMode`：直链 API 来源，支持 `preset` 和 `custom`，默认 `preset`。
- `customMetingApi`：自定义 Meting API 地址，仅在 `sourceMode = custom` 时使用。
- `sendMode`：发送方式，默认 `audio-url`。
- `generationTip`：发送前提示，默认空字符串，不额外刷提示消息。
- `debug`：是否输出详细调试日志，默认关闭。

## 错误处理

工具失败时不向用户暴露堆栈，只返回简短工具结果：

- 搜不到歌：`没有找到合适歌曲。`
- 直链解析失败：`找到了歌曲，但暂时无法获取播放地址。`
- 发送失败：`找到了歌曲，但语音发送失败。`
- 网络超时：`音乐服务暂时不可用。`

详细错误写入 Koishi 日志，方便排查 Meting API、网易云接口、OneBot 发送失败等问题。

## 风险

- AI 自主调用且不做防刷限制，可能在群聊中频繁发送整首歌。
- 整首歌文件较大，`audio-buffer` 模式可能较慢，也可能触发平台发送限制。
- `audio-url` 模式最简单，但不同 OneBot 实现对远程音频 URL 的兼容性不同。
- Meting API 依赖第三方服务，可用性不稳定。

这些风险在第一版接受，不额外实现限制逻辑。

## 测试计划

单元测试：

- 网易云搜索响应能转换为内部歌曲数据。
- Meting API 返回纯 URL 或 JSON URL 时都能解析。
- 搜不到歌时工具返回失败文本且不发送消息。
- `audio-url`、`audio-buffer`、`file` 三种发送模式会调用对应 Koishi 元素。

构建验证：

- TypeScript 类型检查通过。
- 插件包结构能被 Koishi 识别。

手动验证：

- 在 Koishi + ChatLuna + chatluna-character 环境中启用工具调用。
- 在自然聊天中让角色判断需要放歌。
- OneBot / QQ 会话中确认收到整首歌音频，或能从日志看到明确失败原因。

## 验收标准

- 插件不修改 `chatluna-character` 源码。
- 插件能注册 ChatLuna 工具。
- AI 能通过工具自主触发网易云搜歌。
- 插件能按配置向当前会话发送选中的整首歌。
- 失败不会导致角色回复流程崩溃，并会返回可理解的失败文本。
