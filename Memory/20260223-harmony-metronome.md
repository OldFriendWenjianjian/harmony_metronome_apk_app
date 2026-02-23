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

### TODO-3: AudioOutputService + BackgroundPlayService（2026-02-23）

**产出物清单：**
- `entry/src/main/ets/audio/AudioOutputService.ts`（~160 行）— AudioRenderer callback 模式封装
- `entry/src/main/ets/service/BackgroundPlayService.ts`（~90 行）— AUDIO_PLAYBACK 长时任务管理

**关键设计决策：**
- AudioRenderer 配置：SAMPLE_FORMAT_F32LE / CHANNEL_1 / SAMPLE_RATE_48000 / STREAM_USAGE_MUSIC
- 采样率获取策略：优先 renderer.getAudioStreamInfo()，失败时 fallback 48000Hz
- writeData 回调捕获 engineRef 本地引用，避免重复检查 this.engine 可空性
- init() 中一次性完成 renderer 创建 + engine 构建 + voiceBank 加载 + callback 注册
- start() 中先 prepare() 再 reset() 后 renderer.start()，确保每次播放从干净状态开始
- stop() 先 renderer.stop() 再 engine.reset()，保证回调停止后才清除引擎状态
- release() 先 stop 再 release renderer，清空所有引用
- BackgroundPlayService 使用 wantAgent 创建通知栏入口，指向 EntryAbility
- startBackgroundRunning 使用 BackgroundMode.AUDIO_PLAYBACK
- 两个服务均做了重复调用保护（幂等性）和完整错误链传播

## 实现步骤

### TODO-3 步骤记录
1. 确认 audio/ 目录已存在，创建 service/ 目录
2. 实现 AudioOutputService.ts：AudioRenderer 创建、采样率获取、MetronomeEngine + VoiceSampleBank 初始化、writeData 回调注册、start/stop/release 生命周期
3. 实现 BackgroundPlayService.ts：WantAgent 创建、AUDIO_PLAYBACK 长时任务申请/释放、状态管理
4. 验证无 linter 错误
5. 更新 Progress.md、Coordinate.md、Memory 文档

## 错误记录和解决方法

### TODO-1
- 无编译/运行时错误（项目需在 DevEco Studio 中构建，此阶段仅创建文件结构）

### TODO-2
- 无编译/linter 错误。项目需在 DevEco Studio 中进行完整构建验证。

### TODO-3
- 无 linter 错误。项目需在 DevEco Studio 中进行完整构建验证。
- 注意：module.json5 需要 TODO-4 配置 requestPermissions 和 backgroundModes 才能使后台任务生效

### TODO-4: MetronomeViewModel + MetronomePage + 最终集成（2026-02-23）

**产出物清单：**
- `entry/src/main/ets/viewmodel/MetronomeViewModel.ts`（348 行）— 状态管理中枢，双向同步引擎与持久化
- `entry/src/main/ets/pages/Index.ets`（448 行）— 完整 ArkUI 深色主题节拍器界面
- `entry/src/main/module.json5`（36 行）— 新增 KEEP_BACKGROUND_RUNNING 权限和 audioPlayback 后台模式

**关键设计决策：**
- MetronomeViewModel 为普通 class，不使用 @Observed 装饰器；页面通过 StateChangeCallback 回调机制同步状态
- 页面使用 9 个 @State 变量镜像 ViewModel 状态，每次 ViewModel 通知变更时批量同步
- 所有参数 setter（setBpm/setMeter/toggleAccent 等）内部自动调用 syncEngineParams + persistSingle，实现改即生效
- beat 回调从音频线程触发，通过 notifyStateChange → syncFromViewModel 更新 UI
- ForEach 节拍圆点使用复合 key（idx + accentBitmask + curBeat）确保状态变更触发重建
- UI 采用深色主题：背景 #1A1A2E，卡片 #16213E，强调色 #E94560，当前拍高亮 #FFD700
- 播放按钮大圆形设计，播放态红色 (#E94560) + 停止态绿色 (#4CAF50)，带发光阴影
- 拍号支持 4 个预设（2/4, 3/4, 4/4, 6/8）+ 自定义步进控制
- 重音圆点可点击切换，accent 大圆 (40vp) vs 普通小圆 (30vp)
- 语音设置含语言选择（EN/中/日）、首拍模式 Toggle、偏移量 Slider (-200~+200ms)
- module.json5 添加 requestPermissions: KEEP_BACKGROUND_RUNNING 和 backgroundModes: audioPlayback

## 实现步骤

### TODO-4 步骤记录
1. 确认 MetronomeViewModel.ts 已存在且实现完整（348 行，含所有 setter 和生命周期方法）
2. 创建完整 Index.ets 页面（448 行），含 BPM/播放/拍号/重音/语音 5 个卡片区域
3. 更新 module.json5 添加权限声明和后台模式配置
4. 验证所有文件行数在限制内
5. 更新 Progress.md、Coordinate.md、Memory 文档

## 错误记录和解决方法

### TODO-4
- 无编译/linter 错误（项目需在 DevEco Studio 中进行完整构建验证）
- 注意：ForEach key 编码策略确保节拍圆点状态变更时正确刷新
- 注意：Slider value 使用单向绑定 + onChange 回调，如拖动时 Slider 不更新可改用 $$ 双向绑定

---

## 静态验证测试（2026-02-23）

**测试者**: tester  
**测试范围**: 完整项目静态验证（配置/资源/代码逻辑）  
**测试轮次**: 2 轮（第 1 轮完整 P0/P1/P2，第 2 轮 P0 重复验证）  

**测试结果**: ✅ **全部通过（37/37 项）** — 无错误

**关键测试覆盖**:
- ✅ SDK 版本、模型版本、Stage 模型配置 — 完全一致
- ✅ 后台权限与后台模式 — KEEP_BACKGROUND_RUNNING + audioPlayback 正确配置
- ✅ 语音 WAV 资源 — 36 个文件（en/zh/ja 各 12 个），路径与代码约定一致
- ✅ 分层图标资源 — AppScope 与 entry 均完整，startIcon 为普通 PNG
- ✅ WAV 解析器逻辑 — 显式校验 RIFF/WAVE/fmt/data，错误处理到位
- ✅ MetronomeEngine 核心参数 — accent/normal click 频率与幅度、相位连续切换、重音 bitmask
- ✅ AudioRenderer streamInfo — F32LE/Mono/48kHz 完全正确
- ✅ PreferencesManager 键名 — 7 个键名精确匹配，数值 clamp 与语言白名单验证正确
- ✅ ViewModel 状态对齐 — 7 个状态字段、EngineParams 接口一一对应，persistSingle 键名完全一致
- ✅ UI 控件完整性 — BPM/播放/拍号/重音/语音设置 5 个区域全部存在且绑定正确
- ✅ @ohos.* 替换为 @kit.* — entry/src/main/ets 下 `@ohos.` 匹配数=0，全部使用 @kit.*
- ✅ 文件行数限制 — 最大 448 行（Index.ets），远低于 1500 行限制

**测试证据路径**: `AgentContext/20260223-harmony-metronome/test_report.md`
