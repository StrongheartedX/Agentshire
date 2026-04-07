# ROADMAP

> This roadmap tracks where Agentshire is and where it's going.  
> Agentshire is an OpenClaw plugin that turns AI agents into living NPCs in a 3D town with UGC tools.  
> See [README](./README.md) for full feature list, [VISION](./VISION.md) for why we're building this.

> Agentshire 已经不缺一个愿景。  
> 现在最需要的，是把地基打稳——让每个人都能装上、跑起来、稳定用。

---

## 我们已经建成的 ✅

Agentshire 不是一个还在 PPT 里的项目。今天它已经具备：

- **3D 小镇 + IM Chat** 双模式界面，实时气泡对话，多模态支持
- **Agent = NPC** 实时映射，游戏动画编排（召唤→分配→编码→庆祝→返回）
- **昼夜循环 + 12 种天气 + 程序合成环境音（零音频文件）+ 4 轨动态 BGM**
- **居民工坊**：三源角色模型（内置 12 + Library 300+ + 自定义上传）、AI 生成灵魂、8 槽位动画映射、发布为独立 Agent
- **小镇编辑器**：拖拽放置建筑/道路/灯光，组合/对齐/撤销，JSON 导出 + 游戏级预览
- **灵魂模式（基础版）**：AI 大脑三层决策 + LLM 深度对话 + 关系图谱
- **零 LLM 日常社交** + 班味消除小游戏

所以这份路线图的重点，不是"从 0 到 1"，而是**先让地基稳固，再往上盖楼**。

---

## 当前冲刺 🔥

> 核心原则：**先让小镇稳定跑起来，再让它好玩。**

| # | 方向 | 状态 | 需要 |
|---|------|------|------|
| 1 | **OpenClaw 版本兼容** | 🚨 最高优先 | 架构师 · 系统工程师 |
| 2 | **npm 一键安装** | 阻断中 | 系统工程师 |
| 3 | **插件稳定性** | 进行中 | 全栈工程师 |
| 4 | 灵魂模式完善 | 进行中 | AI 工程师 · 前端 |
| 5 | 地图编辑器与小镇打通 | 进行中 | Three.js 前端 · 系统程序 |
| 6 | 开源发布与社区基建 | 进行中 | 所有愿意帮忙的人 |

### 1. OpenClaw 版本兼容（最高优先）

功能再多，用户装不上、升级就挂，都是白搭。这是当前最大的瓶颈。

**现状**：仅 OpenClaw 2026.3.13 完整可用。4.x 不可用，npm 安装被拦截。

- [ ] **4.x Channel 初始化回归**：外部插件的 `defineChannelPluginEntry` 生命周期未被正确调用，需跟进上游修复或找到兼容方案
- [ ] **Rollup code-splitting 导致工具注册不可见**：`api.registerTool()` 在不同 JS chunk 间的状态隔离，需要上游修复或 workaround
- [ ] **插件 SDK API 可用性差异**：`runEmbeddedPiAgent`（3.13 不可用）/ `subagent.run()`（仅 gateway 请求上下文可用）/ `prepareSimpleCompletionModel()`（LLM 直调），需封装统一兼容层
- [ ] **安全扫描器误报**：`child_process`（浏览器启动）和 LLM proxy（env + network）被标记为危险代码，需重构以通过扫描或推动上游白名单机制
- [ ] 建立跨版本兼容测试矩阵（3.13 / 4.x / latest）

**目标**：同时支持 3.13 + 最新 stable 版本，新版本发布后 48 小时内验证兼容性。

### 2. npm 一键安装

当前 `openclaw plugins install agentshire` 被安全扫描阻断，用户只能 clone → build → link 安装。

- [ ] 重构浏览器启动方式，消除 `child_process` 依赖（或推动 OpenClaw 提供安全的 `api.runtime.openUrl()` 接口）
- [ ] 重构 LLM proxy 的 API Key 解析路径，彻底消除 `process.env` 访问
- [ ] 通过 OpenClaw 安全扫描，实现 `openclaw plugins install agentshire` 开箱即用
- [ ] 自动化 npm 发布流水线（GitHub Actions）

**目标**：一行命令安装，无需 `--dangerously-force-unsafe-install`。

### 3. 插件稳定性

让已经能跑的功能真正稳定。

- [ ] ActivityStream 状态匹配修复：`tool_result` 乱序到达导致"步骤永远 in progress"
- [ ] 冷启动场景下 ChatSessionWatcher 可靠性增强
- [ ] WebSocket 重连后的完整状态恢复（工作流阶段 + NPC 位置 + 对话上下文）
- [ ] 错误提示优化：安装失败 / 连接失败 / LLM 配置缺失时给出清晰的诊断信息
- [ ] 安装诊断命令：帮助用户自查环境问题

### 4. 灵魂模式完善

NPC 已经能自己做决定了。但如果它们睡一觉就忘掉今天发生的事，那算不上真正的生活。

- [ ] NPC 长期记忆持久化（跨会话记住重要事件）
- [ ] 灵魂模式的产品开关与行为配置面板
- [ ] implicit-chat token 成本控制与回退策略优化

### 5. 地图编辑器与小镇打通

你在编辑器里搭好了地图，点下导出——然后呢？现在还差最后一步。

- [ ] 运行时加载编辑器导出的 JSON 地图数据
- [ ] 自定义建筑的交互绑定与灯光恢复
- [ ] 寻路图随地图变化自动生成

### 6. 开源发布与社区基建

- [ ] npm 包自动化发布（依赖 #2 完成）
- [x] CONTRIBUTING.md
- [x] 首次启动欢迎信息与操作指引
- [ ] 完善错误诊断与 FAQ 文档

---

## 下一步 🗺️

### 插件 SDK 兼容层

抽象一层统一的 compat shim，屏蔽 OpenClaw 不同版本的 API 差异：

- **LLM 调用**：自动选择 `prepareSimpleCompletionModel` → `runEmbeddedPiAgent` → direct fetch 回退链
- **工具注册**：检测 `registerTool` 是否生效，自动补充 workspace `TOOLS.md` 兜底
- **Workspace 路径**：统一解析逻辑，兼容不同版本的默认路径约定
- **子 Agent 管理**：封装 `subagent.run()` 的上下文限制，提供统一的异步任务接口

### 开发者体验

- e2e 测试覆盖：安装 → 启动 → 对话 → 工作流全链路自动化验证
- 版本兼容性 CI：每个 PR 自动在多个 OpenClaw 版本上跑测试
- 插件开发文档：让其他开发者能参考 Agentshire 的模式开发自己的 OpenClaw 插件

### 手机版完整体验

难点不在响应式布局——真正的难点是：**手机如何和本地电脑上的 OpenClaw 无缝打通。**

- [ ] 解决移动端与本地 Gateway 的 WebSocket 穿透（可能需要云端中继）
- [ ] 移动端 3D 性能优化（模型 LOD、粒子降级）

---

## 中期愿景：让小镇真正像小镇 🗺️

当工程基础稳固之后，让小镇从"会动"变成"会生活"：

- **衣**：NPC 外观换装，随季节 / 心情 / 成长变化
- **食**：建筑内互动——咖啡馆恢复精力、餐厅社交场景
- **住**：住宅归属感——回家、装饰、邻里关系
- **行**：更自然的出行——有目的、有途中小事件
- **玩**：更多小游戏 + NPC 间的娱乐互动（班味消除只是第一个）

以及一套完整的成长体系：

- NPC 经验值与技能树
- 小镇繁荣度（随活动积累，解锁新地块和建筑）
- 成就系统 / 小镇编年史

**这里是游戏策划和游戏美术发挥的绝佳舞台。**

---

## 远期愿景：当孤岛开始连接 🌍

一个人的小镇是温馨的。

但如果每个用户都有一座小镇——那这些小镇就不该永远彼此隔绝。

你的架构师去朋友的小镇做客，帮忙 review 一段代码。  
两个不同主人的 Agent 在边界偶遇，交换了各自学会的技能。  
一个全球事件发生时，所有连接的小镇一起行动。

仪表盘之间不会产生连接。  
但小镇与小镇之间，天然会。

**当孤岛连成大陆，小镇就长成了世界。**

---

## 加入我们 🤝

Agentshire 不只欢迎某一种"标准人才"。

**当前最需要：**

- **架构师 / 系统工程师**：OpenClaw 插件 SDK 兼容层、跨版本测试、构建与发布流水线
- **OpenClaw 社区贡献者**：上游 Bug 修复（Channel init 回归、code-splitting 状态隔离、工具注册机制）
- **全栈工程师**：插件稳定性、WebSocket 可靠性、错误诊断系统

**同样欢迎：**

- **AI 工程师**：灵魂模式、NPC 大脑、长期记忆、多 Agent 编排
- **游戏策划**：游戏循环、成长数值、事件系统、小镇节奏
- **游戏美术**：建筑 / 角色 / 道具 / 动画 / UI / 世界气质
- **程序开发**：Three.js 前端、Node 后端、编辑器打通、小游戏、协议
- **内容创作者**：NPC 人设、灵魂文件、对话、小镇叙事

**但更重要的是：** 我们也欢迎所有不被专业定义的人。

你不一定是职业策划，不一定是专业美术，甚至不一定已经很懂 AI。  
只要你认同这件事：

> 每个用户未来都会拥有自己的 AI 团队。  
> 而这些团队，值得拥有一个可以生活、成长、工作、娱乐的地方。

那你就已经是这件事的同路人。

**怎么参与：**

- 看看 [Issues](https://github.com/Agentshire/Agentshire/issues) 里有没有感兴趣的方向
- 开一个 Issue 或 Discussion，聊想法、提方案
- 直接 Fork → PR，任何大小的贡献都欢迎
- 联系我们：`hello@agentshire.dev` · [@AgentshireDev](https://x.com/AgentshireDev)

---

> *这份路线图会持续变化。但有一件事不会变：*  
> *地基不稳的房子盖不高。先让每个人都能稳定地进入小镇，然后一起把它建成一个值得住进去的世界。*
