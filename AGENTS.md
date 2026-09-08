# AGENTS.md — 工程约定速查

## 命令（根目录执行）

- `pnpm typecheck` — 全 workspace tsc --noEmit
- `pnpm lint` — ESLint（flat config）
- `pnpm test` / `pnpm test:coverage` — Vitest（覆盖率门禁：lines ≥90，branches ≥80）
- `pnpm bench` — tinybench 基准（缓存命中 p99 <20ms；先自动 build）
- `pnpm build` — 各包 tsc 构建到 dist/
- `pnpm gen:schemas` — 重新生成 packages/core/schemas/*.json 快照

## 实现方法论

- **TDD 红-绿-重构**：每个 Sprint 的测试先行清单在 `docs/DESIGN.md` §10；先写失败测试、确认红、再实现转绿
- 禁止"先实现后补测试"

## 依赖规则（docs/DESIGN.md §4）

- `@nexus/core` 零运行时依赖（zod 除外）
- 上游 SDK 类型（`@deepseek-ai/cordis` 等）只允许出现在 `packages/adapter-dsh`
- PDP / funes 交互一律走进程或网络边界（mock 测试，不引入真实上游依赖）

## 平台兼容

- 支持 macOS（Apple Silicon 原生 arm64）与 Linux x64/arm64；CI 矩阵含 `macos-latest`（arm64）
- 脚本必须 POSIX 兼容：macOS bash 3.2，禁止 GNU-only 参数（如 `sed -i` 无后缀、`grep -P`）

## 契约快照

- `packages/core/schemas/*.json` 是跨语言契约（Omnigent Python 侧消费）；变更须 `pnpm gen:schemas` 重新生成并单独 commit 说明

## 工具链

- Node ≥22（本机安装于 `~/.local/node22`）；pnpm 版本见根 `package.json` 的 `packageManager` 字段
- 测试与 typecheck 经 tsconfig paths + vitest alias 直连 workspace 源码，无需先 build；`pnpm bench` 与发布产物走 dist（脚本内已自动 build）
