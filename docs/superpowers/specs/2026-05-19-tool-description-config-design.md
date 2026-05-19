# 工具描述配置设计

## 目标

在 Koishi 插件配置页的“工具名称”下方增加“工具描述”配置项，让用户可以自定义 ChatLuna 工具列表中展示的工具说明。

## 设计

- 新增配置字段 `toolDescription`，放在 `toolName` 后面。
- 默认值沿用当前固定描述：`用于搜索网易云音乐并在当前聊天中发送整首歌曲音频或语音。`
- 注册 ChatLuna 工具时读取 `config.toolDescription`。
- 如果用户把描述留空或只输入空格，注册时回退到默认描述，避免工具描述为空。

## 测试

- `tests/tool.test.ts` 覆盖自定义工具描述会传给 `registerTool`。
- `tests/tool.test.ts` 覆盖空白工具描述会回退到默认描述。
- 运行现有测试和类型检查确认没有破坏已有行为。
