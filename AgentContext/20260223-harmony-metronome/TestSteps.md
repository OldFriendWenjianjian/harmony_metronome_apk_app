# TestSteps — Harmony Metronome（静态验证）

> 约束：HarmonyOS NEXT 项目**禁止**使用命令行 `hvigorw` 构建；本测试仅做**静态验证**（工程结构/资源文件/配置/代码逻辑一致性），不做运行时验证。

## 0. 测试准备与约定

### 0.1 路径占位符

- `{ProjectRoot}`：项目工作区根目录
- `{CollabDir}`：协作目录 `AgentContext/20260223-harmony-metronome/`

### 0.2 允许的工具/操作（静态）

- DevEco Studio GUI：打开工程、查看/搜索源码、查看 JSON/JSON5、查看文件行数
- 文件浏览器：核对资源文件是否存在、文件名与数量
- **禁止**：命令行 `hvigorw` 构建/打包/运行

### 0.2.1 自动化入口（等效于 AI_Operate）

- 本项目未提供独立的 `AI_Operate` 自动化接口；本测试采用 **DevEco Studio GUI 的“在路径中查找（Search in Path）/工程树资源核对/Problems 面板诊断”** 作为等效自动化入口。

### 0.3 证据留存（建议）

- 建议在 `{CollabDir}/evidence/` 下按测试编号保存截图或文本摘录（例如 `TS-001_build-profile.png`、`TS-010_voice-tree.png`）。
- 仅静态验证时，证据优先用：IDE 截图（含文件路径+关键行）/ 文件树截图 / 全局搜索结果截图（含“匹配数量”）。

### 0.3.1 静态“日志/错误信息”获取方式（用于可判定结论）

- **全局搜索计数**：DevEco Studio “在路径中查找”结果面板中显示的“匹配数量/文件列表”截图
- **JSON/JSON5 解析错误**：打开文件时编辑器提示（红线/提示条）或 Problems 面板条目截图
- **TypeScript/ETS 语法与类型诊断**：Problems 面板截图（不要求构建，仅要求静态诊断无新增严重错误）

### 0.4 失败处理与报告（必须遵循）

- 任一测试项不通过：在 `{CollabDir}` 新建 `error_report+YYYYMMDD-HHmm.md`
  - 标题：`Error Report - <测试编号> - <简述>`
  - 内容至少包含：复现步骤（按本文步骤）、期望、实际、证据路径（截图/摘录）、状态标记：`待修复`
- 全部通过：在 `{CollabDir}` 新建 `test_report.md`
  - 内容至少包含：测试范围（覆盖的 TS 列表）、轮次、通过证据路径

### 0.5 多轮重复测试要求（必须）

- **轮次**：至少 2 轮静态检查
  - 第 1 轮：首次打开工程后完成全部 P0、P1
  - 第 2 轮：关闭 DevEco Studio 后重新打开工程，再次执行全部 P0（重点是“全局搜索计数”和“关键配置字段”一致）
- **停止条件**：连续 2 轮 P0 全通过，且第 2 轮无新增差异/遗漏。

---

## 1. 测试项清单（静态检查步骤）

> 字段说明：
> - **测试编号**：TS-xxx
> - **测试类别**：Project / Config / Resource / Code / UI / Consistency / Quality
> - **测试步骤**：仅静态检查步骤
> - **通过标准**：可判定（精确字段/文本/数量/搜索结果）
> - **优先级**：P0（必须）/ P1（重要）/ P2（建议）

### TS-001 — build-profile 基础配置（SDK/OS）

- 测试编号：TS-001
- 测试类别：Project
- 测试步骤：
  1. 在 DevEco Studio 打开 `{ProjectRoot}/build-profile.json5`。
  2. 定位 `compatibleSdkVersion` 与 `runtimeOS` 字段（位于 `app.products[0]`）。
- 通过标准：
  - `compatibleSdkVersion` 精确为 `"5.0.0(12)"`
  - `runtimeOS` 精确为 `"HarmonyOS"`
- 优先级：P0

### TS-002 — hvigor modelVersion 配置

- 测试编号：TS-002
- 测试类别：Project
- 测试步骤：
  1. 打开 `{ProjectRoot}/hvigor/hvigor-config.json5`。
  2. 查找 `modelVersion`。
- 通过标准：
  - `modelVersion` 精确为 `"5.0.0"`
- 优先级：P0

### TS-003 — oh-package.json5 根目录与 entry 目录存在

- 测试编号：TS-003
- 测试类别：Project
- 测试步骤：
  1. 在工程树中确认 `{ProjectRoot}/oh-package.json5` 存在且可打开。
  2. 确认 `{ProjectRoot}/entry/oh-package.json5` 存在且可打开。
- 通过标准：
  - 两个文件均存在且为有效 JSON5（DevEco Studio 可正常解析/高亮）
- 优先级：P0

### TS-004 — Stage 模型入口页配置（main_pages.json）

- 测试编号：TS-004
- 测试类别：Config
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/resources/base/profile/main_pages.json`。
  2. 检查 `src` 数组内容。
- 通过标准：
  - `src` 仅包含 `"pages/Index"`（至少包含该项，且路径拼写一致）
- 优先级：P0

### TS-005 — EntryAbility 加载 pages/Index

- 测试编号：TS-005
- 测试类别：Config
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/entryability/EntryAbility.ts`。
  2. 定位 `onWindowStageCreate` 内的 `windowStage.loadContent(...)`。
- 通过标准：
  - `loadContent` 的页面参数精确为 `'pages/Index'`
- 优先级：P1

### TS-006 — module.json5 后台权限与后台模式

- 测试编号：TS-006
- 测试类别：Config
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/module.json5`。
  2. 检查 `requestPermissions` 是否包含 `ohos.permission.KEEP_BACKGROUND_RUNNING`。
  3. 检查 `abilities[0].backgroundModes` 是否包含 `audioPlayback`。
- 通过标准：
  - 存在 `{"name": "ohos.permission.KEEP_BACKGROUND_RUNNING"}`（大小写/拼写一致）
  - `backgroundModes` 精确包含 `"audioPlayback"`（数组中包含该值即可）
- 优先级：P0

### TS-007 — 分层图标配置文件存在（layered-image JSON）

- 测试编号：TS-007
- 测试类别：Resource
- 测试步骤：
  1. 确认 `{ProjectRoot}/AppScope/resources/base/media/app_icon.json` 存在并可打开。
  2. 确认 `{ProjectRoot}/entry/src/main/resources/base/media/icon.json` 存在并可打开。
  3. 检查两者都含 `layered-image.background` 与 `layered-image.foreground`。
- 通过标准：
  - 两个 JSON 均使用 `"$media:background"` 与 `"$media:foreground"` 作为引用（字段名与值一致）
- 优先级：P1

### TS-008 — 分层图标资源文件存在（foreground/background PNG）

- 测试编号：TS-008
- 测试类别：Resource
- 测试步骤：
  1. 在工程树中确认以下文件存在：
     - `{ProjectRoot}/AppScope/resources/base/media/background.png`
     - `{ProjectRoot}/AppScope/resources/base/media/foreground.png`
     - `{ProjectRoot}/entry/src/main/resources/base/media/background.png`
     - `{ProjectRoot}/entry/src/main/resources/base/media/foreground.png`
- 通过标准：
  - 以上 4 个 PNG 文件都存在，文件名与大小写一致
- 优先级：P1

### TS-009 — startWindowIcon 使用普通 PNG（startIcon）

- 测试编号：TS-009
- 测试类别：Resource
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/module.json5`。
  2. 定位 `abilities[0].startWindowIcon`。
  3. 在工程树中确认 `{ProjectRoot}/entry/src/main/resources/base/media/startIcon.png` 存在。
- 通过标准：
  - `startWindowIcon` 精确为 `"$media:startIcon"`
  - `startIcon.png` 存在（且不是 `startIcon.json` 这类分层配置）
- 优先级：P0

### TS-010 — 语音 WAV 资源目录结构与数量（en/zh/ja 各 12 个）

- 测试编号：TS-010
- 测试类别：Resource
- 测试步骤：
  1. 在工程树展开 `{ProjectRoot}/entry/src/main/resources/rawfile/voice/`。
  2. 进入 `en`、`zh`、`ja` 三个目录，分别检查文件数量与命名。
- 通过标准：
  - `en/` 下存在 `1.wav`~`12.wav` 共 12 个
  - `zh/` 下存在 `1.wav`~`12.wav` 共 12 个
  - `ja/` 下存在 `1.wav`~`12.wav` 共 12 个
- 优先级：P0

### TS-011 — VoiceSampleBank rawfile 路径约定一致

- 测试编号：TS-011
- 测试类别：Code
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/audio/VoiceSampleBank.ts`。
  2. 定位 `init()` 内的 rawfile 路径拼接。
- 通过标准：
  - 路径模板精确为：``voice/${lang}/${beat}.wav``（`voice/` + 三语种 + 1~12）
  - 支持语言列表包含 `['en','zh','ja']`
- 优先级：P0

### TS-012 — VoiceSampleBank WAV 解析覆盖 RIFF/fmt/data

- 测试编号：TS-012
- 测试类别：Code
- 测试步骤：
  1. 在 `VoiceSampleBank.ts` 定位 `parseWav(...)`。
  2. 检查是否显式校验并解析：
     - `RIFF` header
     - `WAVE` tag
     - `fmt ` chunk（读取 audioFormat/numChannels/sampleRate/bitsPerSample）
     - `data` chunk（定位 dataOffset/dataSize）
- 通过标准：
  - 代码中存在对 `'RIFF'`、`'WAVE'`、`'fmt '`、`'data'` 的显式判定与错误抛出
  - `fmt` 与 `data` 缺失时会抛出可读错误（含 sourcePath）
- 优先级：P0

### TS-013 — VoiceSampleBank 重采样为线性插值（linear interpolation）

- 测试编号：TS-013
- 测试类别：Code
- 测试步骤：
  1. 在 `VoiceSampleBank.ts` 定位 `resampleLinear(...)`。
  2. 检查核心插值公式是否为线性插值（使用 `frac`、`1.0-frac` 权重）。
- 通过标准：
  - 存在形如 `output[i] = input[a]*(1-frac) + input[b]*frac` 的线性插值实现
  - `sourceSampleRate === targetSampleRate` 时返回输入拷贝（避免无谓处理）
- 优先级：P1

### TS-014 — MetronomeEngine click 参数（频率/幅度/时长）

- 测试编号：TS-014
- 测试类别：Code
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/audio/MetronomeEngine.ts`。
  2. 在常量区定位 click 参数常量。
- 通过标准：
  - accent：`1000 Hz` 且 amplitude `0.8`
  - normal：`800 Hz` 且 amplitude `0.5`
  - click 时长：`30 ms`（以 `0.03` 秒形式出现亦可）
- 优先级：P0

### TS-015 — MetronomeEngine 重音 bitmask 判定逻辑

- 测试编号：TS-015
- 测试类别：Code
- 测试步骤：
  1. 在 `MetronomeEngine.ts` 定位 `renderAudio(...)` 内 beat 触发分支。
  2. 检查 `isAccent` 是否通过 bit 运算由 `accentBitmask` 决定。
- 通过标准：
  - 存在位移+按位与判定：`((accentBitmask >>> beatIdx) & 1) === 1`（语义等价即可）
- 优先级：P1

### TS-016 — MetronomeEngine 相位连续 BPM 切换（nextBeatFrame 重新对齐）

- 测试编号：TS-016
- 测试类别：Code
- 测试步骤：
  1. 在 `MetronomeEngine.ts` 定位参数变化处理（如 `handleParamChanges()`）。
  2. 检查 bpm 或 meterDenominator 变化时对 `framesPerBeat` 与 `nextBeatFrame` 的更新方式。
- 通过标准：
  - bpm/denom 变化时会重算 `framesPerBeat`
  - `nextBeatFrame` 以“当前已渲染帧”为基准更新（例如：`totalFramesRendered + newFramesPerBeat`），而不是回到 0
- 优先级：P0

### TS-017 — MetronomeEngine 语音混音与偏移/首拍逻辑

- 测试编号：TS-017
- 测试类别：Code
- 测试步骤：
  1. 在 `MetronomeEngine.ts` 定位语音触发收集逻辑（如 `collectVoiceTriggers`）。
  2. 检查：
     - `voiceOffsetMs` 是否转换为帧偏移（ms→frames）
     - `firstBeatOnly` 控制是否只在 beatInMeasure==0 时触发语音
     - 负偏移是否存在 lookahead 扫描（避免语音起点落在当前 buffer 内而 beat 在未来）
- 通过标准：
  - 存在 `voiceOffsetMs / 1000 * sampleRate` 的换算
  - `firstBeatOnly` 为 true 时仅首拍触发语音（语义等价即可）
  - offset<0 时存在 lookahead 机制（例如最大 0.2s 或与偏移取较大值的扫描窗口）
- 优先级：P1

### TS-018 — AudioOutputService renderer streamInfo 格式固定（F32LE/Mono/48k）

- 测试编号：TS-018
- 测试类别：Code
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/audio/AudioOutputService.ts`。
  2. 定位 `AudioRendererOptions.streamInfo`。
- 通过标准：
  - `sampleFormat`：`SAMPLE_FORMAT_F32LE`
  - `channels`：`CHANNEL_1`
  - `samplingRate`：`SAMPLE_RATE_48000`
- 优先级：P0

### TS-019 — AudioOutputService callback(writeData) 接线到 engine.renderAudio

- 测试编号：TS-019
- 测试类别：Code
- 测试步骤：
  1. 在 `AudioOutputService.ts` 定位 `renderer.on('writeData', ...)`。
  2. 检查回调中对 `ArrayBuffer` 的处理与引擎调用。
- 通过标准：
  - 回调内将 `buffer` 包装为 `Float32Array`
  - 调用 `engine.renderAudio(floatView, floatView.length)`（或等价：frames==floatView.length）
- 优先级：P0

### TS-020 — BackgroundPlayService 使用 AUDIO_PLAYBACK 长时任务

- 测试编号：TS-020
- 测试类别：Code
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/service/BackgroundPlayService.ts`。
  2. 定位 `startBackgroundRunning` 调用。
- 通过标准：
  - 使用 `backgroundTaskManager.BackgroundMode.AUDIO_PLAYBACK`
  - 创建 `WantAgent` 且目标 abilityName 为 `EntryAbility`（语义等价即可）
- 优先级：P1

### TS-021 — PreferencesManager 键名集合（7 个键）与范围约束

- 测试编号：TS-021
- 测试类别：Consistency
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/data/PreferencesManager.ts`。
  2. 检查 `KEYS` 是否包含并仅包含以下键名：
     - `bpm`
     - `meter_numerator`
     - `meter_denominator`
     - `accent_bitmask`
     - `language`
     - `first_beat_only`
     - `voice_offset_ms`
  3. 检查 `load()` 是否对 bpm/meter/offset 做数值 clamp，对 language 做白名单。
- 通过标准：
  - `KEYS` 中 7 个键名拼写完全一致
  - `language` 仅允许 `en/zh/ja`（否则回退到默认）
  - `voiceOffsetMs` clamp 到 `[-200, 200]`
- 优先级：P0

### TS-022 — ViewModel 状态字段与 Preferences 键名对应

- 测试编号：TS-022
- 测试类别：Consistency
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/viewmodel/MetronomeViewModel.ts`。
  2. 检查可观察状态字段是否覆盖 7 个设置项（bpm、拍号、重音、语言、首拍、偏移）。
  3. 检查 `persistSingle('<key>', ...)` 的 key 与 TS-021 的键名一致。
- 通过标准：
  - ViewModel 内持有并维护 7 个状态字段：`bpm/meterNumerator/meterDenominator/accentBitmask/language/firstBeatOnly/voiceOffsetMs`
  - `persistSingle` 使用的 key 精确匹配：`bpm`、`meter_numerator`、`meter_denominator`、`accent_bitmask`、`language`、`first_beat_only`、`voice_offset_ms`
- 优先级：P0

### TS-023 — EngineParams 接口与 ViewModel 状态同步（字段对齐）

- 测试编号：TS-023
- 测试类别：Consistency
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/audio/MetronomeEngine.ts`，确认 `EngineParams` 字段集合。
  2. 打开 `MetronomeViewModel.ts`，定位 `buildEngineParams()`。
- 通过标准：
  - `EngineParams` 字段与 `buildEngineParams()` 返回对象字段一一对应，且覆盖：
    `bpm/meterNumerator/meterDenominator/accentBitmask/language/firstBeatOnly/voiceOffsetMs`
- 优先级：P0

### TS-024 — BPM 范围 30-300：ViewModel 与 UI Slider 一致

- 测试编号：TS-024
- 测试类别：Consistency
- 测试步骤：
  1. 在 `MetronomeViewModel.ts` 定位 `setBpm()`。
  2. 在 `{ProjectRoot}/entry/src/main/ets/pages/Index.ets` 定位 BPM `Slider({ min, max })`。
- 通过标准：
  - ViewModel：`setBpm` 将 bpm clamp 到 `[30, 300]`
  - UI：BPM Slider `min: 30` 且 `max: 300`
- 优先级：P0

### TS-025 — 拍号分母限制 [1,2,4,8,16] 在 ViewModel 中验证

- 测试编号：TS-025
- 测试类别：Consistency
- 测试步骤：
  1. 在 `MetronomeViewModel.ts` 检查 `VALID_DENOMINATORS`。
  2. 检查 `setMeterDenominator()` 是否使用该白名单验证输入。
  3. 检查 `nextDenominator()/prevDenominator()` 是否按该列表步进。
- 通过标准：
  - `VALID_DENOMINATORS` 精确为 `[1,2,4,8,16]`
  - `setMeterDenominator` 对不在白名单的值直接拒绝（不修改状态）
- 优先级：P0

### TS-026 — UI：BPM 区域完整（显示/滑块/微调按钮）

- 测试编号：TS-026
- 测试类别：UI
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/src/main/ets/pages/Index.ets`。
  2. 定位 `BpmSection()`。
  3. 静态核对：BPM 数字显示、Slider、以及 4 个微调按钮的文案与 onClick。
- 通过标准：
  - 存在 BPM 数值显示（`Text(this.bpm.toString())` 或等价）
  - Slider 具备 `min: 30`、`max: 300`
  - 4 个按钮文案：`-5`、`-1`、`+1`、`+5`，且分别调用 `vm.adjustBpm(-5/-1/1/5)`
- 优先级：P0

### TS-027 — UI：播放/停止按钮存在并绑定 ViewModel

- 测试编号：TS-027
- 测试类别：UI
- 测试步骤：
  1. 在 `Index.ets` 定位 `PlaySection()`。
  2. 检查按钮点击行为。
- 通过标准：
  - 存在播放/停止切换按钮（UI 文本可为 ▶/■ 或等价）
  - 点击处理调用 `vm.togglePlay()`（允许有 `.catch(...)` 包裹）
- 优先级：P0

### TS-028 — UI：拍号预设 + 自定义控制

- 测试编号：TS-028
- 测试类别：UI
- 测试步骤：
  1. 在 `Index.ets` 定位 `MeterSection()`。
  2. 静态核对预设按钮：2/4、3/4、4/4、6/8。
  3. 静态核对自定义控制：分子 +/-、分母 +/-（或步进）按钮存在且绑定 ViewModel。
- 通过标准：
  - 预设按钮文案包含：`2/4`、`3/4`、`4/4`、`6/8`，且分别调用 `vm.setMeterPreset(2,4)/(3,4)/(4,4)/(6,8)`
  - 分子调整调用 `vm.setMeterNumerator(this.meterNumerator ± 1)`（语义等价即可）
  - 分母调整调用 `vm.prevDenominator()` 与 `vm.nextDenominator()`
- 优先级：P0

### TS-029 — UI：重音圆点可视化与交互切换

- 测试编号：TS-029
- 测试类别：UI
- 测试步骤：
  1. 在 `Index.ets` 定位 `AccentSection()`。
  2. 检查是否按拍号生成圆点（ForEach/循环），并在点击时调用 ViewModel。
- 通过标准：
  - 使用 `ForEach`（或等价方式）基于拍号分子生成圆点
  - 每个圆点点击调用 `vm.toggleAccent(idx)`（idx 为拍索引）
  - 可视化状态与 `accentBitmask` 和/或 `curBeat` 关联（例如颜色/大小/高亮）
- 优先级：P1

### TS-030 — UI：语音设置区完整（语言/首拍/偏移）

- 测试编号：TS-030
- 测试类别：UI
- 测试步骤：
  1. 在 `Index.ets` 定位 `VoiceSection()`。
  2. 静态核对：
     - 语言选择按钮（EN/中/日）与 onClick
     - 首拍模式 Toggle
     - 偏移量显示与 Slider 范围
- 通过标准：
  - 语言按钮存在且分别调用 `vm.setLanguage('en'/'zh'/'ja')`
  - Toggle 的 `onChange` 调用 `vm.setFirstBeatOnly(isOn)`
  - 偏移 Slider：`min: -200`、`max: 200`
- 优先级：P0

### TS-031 — UI：pageTransition 动画存在

- 测试编号：TS-031
- 测试类别：UI
- 测试步骤：
  1. 在 `Index.ets` 搜索 `pageTransition()` 方法。
  2. 检查 enter/exit 是否定义了 duration 且包含 slide/opacity。
- 通过标准：
  - 存在 `pageTransition()` 定义
  - 同时定义 Enter 与 Exit（或等价），并设置 `duration`
- 优先级：P2

### TS-032 — UI：Scroll edgeEffect 为 Spring

- 测试编号：TS-032
- 测试类别：UI
- 测试步骤：
  1. 在 `Index.ets` 定位 `Scroll()` 组件链。
  2. 检查 `.edgeEffect(...)` 参数。
- 通过标准：
  - 使用 `.edgeEffect(EdgeEffect.Spring)`
- 优先级：P1

### TS-033 — 代码质量：主代码 import 仅使用 @kit.*（无 @ohos.*）

- 测试编号：TS-033
- 测试类别：Quality
- 测试步骤：
  1. 在 DevEco Studio 对路径 `{ProjectRoot}/entry/src/main/ets` 执行“在路径中查找”：
     - 查找 `from '@ohos.`（或 `@ohos.`）
     - 查找 `from "@ohos.`
  2. 对同一路径查找 `from '@kit.`（或 `@kit.`）作为对照。
- 通过标准：
  - 在 `{ProjectRoot}/entry/src/main/ets` 下，`@ohos.` 的 import 匹配数量为 **0**
  - 在 `{ProjectRoot}/entry/src/main/ets` 下，存在 `@kit.` 的 import（匹配数量 > 0）
- 优先级：P0

### TS-034 — 代码质量：单文件行数不超过 1500

- 测试编号：TS-034
- 测试类别：Quality
- 测试步骤：
  1. 在 DevEco Studio 依次打开以下关键文件并记录行数（IDE 通常在状态栏/行号栏可见）：
     - `{ProjectRoot}/entry/src/main/ets/pages/Index.ets`
     - `{ProjectRoot}/entry/src/main/ets/viewmodel/MetronomeViewModel.ts`
     - `{ProjectRoot}/entry/src/main/ets/audio/MetronomeEngine.ts`
     - `{ProjectRoot}/entry/src/main/ets/audio/VoiceSampleBank.ts`
     - `{ProjectRoot}/entry/src/main/ets/audio/AudioOutputService.ts`
     - `{ProjectRoot}/entry/src/main/ets/service/BackgroundPlayService.ts`
     - `{ProjectRoot}/entry/src/main/ets/data/PreferencesManager.ts`
     - `{ProjectRoot}/entry/src/main/ets/entryability/EntryAbility.ts`
  2. 若工程约定要求“所有文件”也满足该限制，则对 `{ProjectRoot}/entry/src/main/ets` 目录下其余文件抽样检查或用 IDE 的文件统计能力检查。
- 通过标准：
  - 上述每个文件行数均 ≤ 1500
- 优先级：P1

### TS-035 — entry/build-profile.json5 为 Stage 模型（apiType=stageMode）

- 测试编号：TS-035
- 测试类别：Project
- 测试步骤：
  1. 打开 `{ProjectRoot}/entry/build-profile.json5`。
  2. 检查 `apiType` 字段。
  3. 检查 `targets` 是否包含名为 `default` 的 target，且其 `runtimeOS` 为 HarmonyOS。
- 通过标准：
  - `apiType` 精确为 `"stageMode"`
  - `targets` 中存在 `{ "name": "default", "runtimeOS": "HarmonyOS" }`（字段与值一致，允许额外字段）
- 优先级：P0

### TS-036 — 根 build-profile.json5 声明 entry 模块（srcPath=./entry）

- 测试编号：TS-036
- 测试类别：Project
- 测试步骤：
  1. 打开 `{ProjectRoot}/build-profile.json5`。
  2. 定位 `modules` 数组，找到 `name: "entry"` 的模块项。
- 通过标准：
  - `modules` 中存在 `name` 为 `"entry"` 的模块
  - 该模块的 `srcPath` 精确为 `"./entry"`
- 优先级：P1

### TS-037 — AppScope/app.json5 使用分层应用图标（$media:app_icon）

- 测试编号：TS-037
- 测试类别：Config
- 测试步骤：
  1. 打开 `{ProjectRoot}/AppScope/app.json5`。
  2. 检查 `app.icon` 的资源引用名。
  3. 进一步确认 `{ProjectRoot}/AppScope/resources/base/media/app_icon.json` 存在（分层配置）。
- 通过标准：
  - `app.icon` 精确为 `"$media:app_icon"`
  - `AppScope/resources/base/media/app_icon.json` 存在且为 layered-image 配置（见 TS-007）
- 优先级：P1

---

## 2. 测试后检查清单（提交前自检）

- P0 全通过且证据齐全（截图/搜索计数）
- 2 轮重复测试完成（TS-001/006/009/010/011/012/014/016/018/019/021/022/023/024/025/026/027/028/030/033/035）
- 失败项已按 0.4 生成 error_report 文档（如有）

