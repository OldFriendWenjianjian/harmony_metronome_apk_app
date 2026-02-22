# Memory — 20260223-harmony-metronome

## 实现内容

### TODO-1: 项目脚手架 + 资源 + PreferencesManager（2026-02-23）

**产出物清单：**
- 根目录配置：`build-profile.json5`, `hvigorfile.ts`, `oh-package.json5`, `hvigor/hvigor-config.json5`
- AppScope：`app.json5`, 字符串资源, 分层图标（`app_icon.json` + `foreground.png` + `background.png`）
- entry 模块配置：`build-profile.json5`, `hvigorfile.ts`, `oh-package.json5`
- entry 源码：`EntryAbility.ts`（加载 pages/Index）, `PreferencesManager.ts`（7 个键的读写 + 参数验证）
- entry 资源：字符串/颜色 JSON, 分层图标, `startIcon.png`（非分层）, `main_pages.json`
- 语音资源：3 语言 × 12 WAV = 36 文件复制到 `rawfile/voice/{en,zh,ja}/`
- ohosTest 骨架：完整测试目录结构含 TestAbility, TestRunner, 测试页面
- 占位页面：`pages/Index.ets`（TODO-4 会替换）

**关键设计决策：**
- PreferencesManager.load() 对所有数值做 clamp 边界验证（BPM 20~300, 分子 1~12 等）
- PreferencesManager 所有异步方法均有 try/catch + 带上下文的错误链包装
- 图标使用纯代码生成的 PNG（Node.js zlib + 手工 PNG 编码），无外部依赖
- startWindowIcon 使用独立的 `startIcon.png`（192×192 非分层），符合 HarmonyOS 要求

## 实现步骤

### TODO-1 步骤记录
1. 创建完整目录结构（20+ 目录）
2. 创建根配置文件（build-profile.json5 含 compatibleSdkVersion "5.0.0(12)"）
3. 创建 AppScope 配置与资源
4. 创建 entry 模块配置
5. 创建 EntryAbility.ts（使用 @kit.* 导入路径）
6. 创建 PreferencesManager.ts（含参数验证与错误处理）
7. 创建 entry 资源文件（字符串、颜色、图标配置、页面路由）
8. 用 PowerShell Copy-Item 复制 36 个 WAV 文件
9. 用 Node.js 脚本生成 5 个 PNG 图标文件（foreground/background 各 1024×1024, startIcon 192×192）
10. 创建占位 pages/Index.ets
11. 创建 ohosTest 完整骨架（6 个文件）
12. 清理临时图标生成脚本

## 错误记录和解决方法

### TODO-1
- 无编译/运行时错误（项目需在 DevEco Studio 中构建，此阶段仅创建文件结构）
