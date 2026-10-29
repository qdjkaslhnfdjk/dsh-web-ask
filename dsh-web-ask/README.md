# dsh-web-ask

把 **DeepSeek 网页版**接进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 桌面客户端：在对话输入框左侧加一个「问网页 AI」按钮，点击后自动读取当前会话，交给已登录的 `chat.deepseek.com` 解释，回答**实时流式**显示在悬浮面板里，**不消耗项目 Agent 的 API 额度**。

> Bring the real DeepSeek website into DeepSeek Harness as a floating "ask" panel. The current conversation is captured and sent to your logged-in chat.deepseek.com session; the answer streams back into the panel — no API tokens spent on the project Agent.

## 工作原理

| 通道 | 说明 |
|---|---|
| 内嵌网页（默认） | 通过桌面版 `dshDesktop.browser` 租约协议内嵌 `chat.deepseek.com`（Electron `<webview>`）。**首次登录一次，之后打开 Harness 即可用**。提问时插件自动填入、发送，并轮询读取回答增量更新到面板。 |
| 浏览器扩展（兜底） | 若内嵌网页在当前环境不可用，且已加载 `bridge/` 扩展，则走已登录的外部浏览器标签页。 |
| 手动复制（兜底） | 「复制上下文并打开网页」按钮随时可用。 |

## 功能特性

- **输入框左侧按钮**：点一下自动抓取当前会话（仅用户与 Agent 的可见文本，不含系统提示、工具结果、隐藏推理）
- **悬浮面板**：上方 AI 回答区（支持表格、代码块、列表的富文本渲染），下方问题输入框（Enter 发送）
- **流式回答**：DeepSeek 打一个字，面板同步多一个字，不必等全部生成完
- **可拖动 / 可缩放**：提问面板和网页窗口都能拖动；网页窗口右下角可拖拽缩放、标题栏可最小化
- **登录持久化**：登录态由 webview 持久分区保留，只需登录一次
- **不占 Agent 额度**：所有问答走你自己的 DeepSeek 网页账号

## 环境要求

- **桌面版 DeepSeek Harness**（macOS / Windows / Linux）。`dsh web` 在浏览器里打开没有 Electron webview，内嵌网页不可用（会自动退回复制/扩展通道）。
- 复用桌面版已有的 webview 租约协议（`dshDesktop.browser`，`protocolVersion === 1`），不绕开主进程的沙箱与网络策略。
- 一个已登录的 DeepSeek 网页账号。

## 安装

```bash
# 从 GitHub 安装（推荐）
dsh plugin --profile desktop add github:qdjkashlnfdjk/dsh-web-ask

# 或从本地 tarball
npm pack
dsh plugin --profile desktop add file:./dsh-web-ask-1.5.2.tgz

# 或本地开发（软链当前目录）
dsh plugin --profile desktop add link:$PWD
```

`dsh plugin add` 会自动把包写进 profile 的 `dsh.profile.bundles`，**完全退出并重开客户端**后生效。

卸载：

```bash
dsh plugin --profile desktop remove dsh-web-ask
```

## 浏览器扩展（可选，兜底用）

仅当桌面版不支持内嵌网页时才需要：

1. 打开 Chrome / Edge 的 `chrome://extensions`
2. 开启「开发者模式」→「加载已解压的扩展程序」
3. 选择 `bridge/` 目录

## 使用

1. 打开 Harness 对话页面，输入框工具行左侧出现「💬 问网页 AI」按钮
2. 点击按钮——自动读取当前会话
3. 首次使用：点面板里的地球图标展开网页，登录 DeepSeek 一次，再收起
4. 面板下方输入问题 → 发送 → 回答流式出现在上方区域 → 可一键复制

## 项目结构

| 文件 | 作用 |
|---|---|
| `package.json` | 插件元信息、`dsh.bundle.patch` 与 `dsh.client` 声明 |
| `index.js` | Node 半侧入口（让 Loader 有条目） |
| `client.js` | 浏览器半侧：slot 注册、悬浮面板 UI、webview 租约、流式问答 |
| `cordis.patch.yml` | 向 profile 插入 Loader 条目 |
| `icon.svg` | 按钮图标 |
| `bridge/` | 浏览器扩展（兜底通道） |
| `tests/` | 上下文提取与插件包完整性单元测试 |

## 开发

```bash
npm test          # 运行单元测试
node --check client.js   # 语法检查
npm pack          # 产出 tarball
```

## 自检与限制

- ✅ 上下文提取与组装：单元测试通过（`npm test`）
- ✅ 全部脚本语法检查通过
- ⚠️ 内嵌 webview 依赖桌面版启用 `dshDesktop.browser` 租约协议；若不可用，面板会提示并自动退回复制/扩展通道
- ⚠️ 网页内自动发送/回读依赖 chat.deepseek.com 的 DOM（`#chat-input`、`.ds-markdown`），网页改版可能失效；失效时会明确报错而非静默失败

## 致谢

webview 租约协议（`dshDesktop.browser.acquire`）的实现方式参考了 [ChengMioa/dsh-deepseek-web-panel](https://github.com/ChengMioa/dsh-deepseek-web-panel)。

## License

MIT，见 [LICENSE](./LICENSE)。
