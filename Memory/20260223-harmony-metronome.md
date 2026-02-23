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

### TODO-2: VoiceSampleBank + MetronomeEngine（2026-02-23）

**产出物清单：**
- `entry/src/main/ets/audio/VoiceSampleBank.ts`（257 行）— WAV 解析 + 线性插值重采样 + 缓存
- `entry/src/main/ets/audio/MetronomeEngine.ts`（336 行）— 帧级节拍调度 + click 波形 + voice 混合

**关键设计决策：**
- WAV 解析器逐 chunk 扫描，支持 fmt 和 data 之间有 LIST/fact 等额外 chunks
- 支持 8/16/24/32 bit PCM，自动下混多声道为单声道
- rawCache 保留原始 PCM 用于动态采样率切换（避免重新读 rawfile）
- 线性插值重采样：ratio = srcRate/tgtRate，逐输出帧计算 srcPos 并在相邻样本间插值
- MetronomeEngine.renderAudio 每帧检查 globalFrame >= nextBeatFrame 触发节拍
- Click 波形预计算：accent 1000Hz/0.8amp，normal 800Hz/0.5amp，30ms 指数衰减
- Voice 偏移通过 collectVoiceTriggers 预扫描实现：正偏移延后、负偏移 lookahead
- 相位连续 BPM 切换：nextBeatFrame = totalFramesRendered + newFramesPerBeat
- 重音 bitmask 使用无符号右移（>>>）避免负数符号扩展
- beatCallback 包裹 try/catch 确保回调异常不中断音频线程

## 实现步骤

### TODO-2 步骤记录
1. 确认 audio/ 目录存在（已由 TODO-1 创建）
2. 实现 VoiceSampleBank.ts：WAV 解析（parseWav）、Float32 转换（readSampleAsFloat）、线性插值重采样（resampleLinear）、缓存管理
3. 实现 MetronomeEngine.ts：EngineParams/BeatEventInfo 接口、click 波形生成（generateSineDecay）、renderAudio 主循环、collectVoiceTriggers 语音触发、handleParamChanges 相位连续切换
4. 验证文件行数（257 + 336，均 < 1500）
5. 无 linter 错误

## 错误记录和解决方法

### TODO-1
- 无编译/运行时错误（项目需在 DevEco Studio 中构建，此阶段仅创建文件结构）

### TODO-2
- 无编译/linter 错误。项目需在 DevEco Studio 中进行完整构建验证。
