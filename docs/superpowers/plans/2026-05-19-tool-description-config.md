# 工具描述配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工具名称配置项下增加工具描述配置，并让 ChatLuna 注册工具时使用该描述。

**Architecture:** 保持现有单工具注册结构不变，只扩展配置类型、Koishi Schema 和注册描述解析。描述解析集中在 `src/tool.ts`，空白值回退到默认描述。

**Tech Stack:** TypeScript, Koishi Schema, ChatLuna tool registration, Vitest.

---

### Task 1: 工具描述配置

**Files:**
- Modify: `tests/tool.test.ts`
- Modify: `src/types.ts`
- Modify: `src/config.ts`
- Modify: `src/tool.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/tool.test.ts` 中让默认测试配置包含 `toolDescription`，并新增空白描述回退测试。

- [ ] **Step 2: 运行聚焦测试确认失败**

Run: `npm test -- tests/tool.test.ts`
Expected: FAIL，因为注册逻辑还没有读取 `toolDescription`。

- [ ] **Step 3: 最小实现**

在 `src/types.ts` 增加 `toolDescription`；在 `src/config.ts` 把配置项放到 `toolName` 下方；在 `src/tool.ts` 注册时使用 `config.toolDescription.trim() || 默认描述`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/tool.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量验证**

Run: `npm test`
Expected: PASS。

Run: `npm run typecheck`
Expected: PASS。
