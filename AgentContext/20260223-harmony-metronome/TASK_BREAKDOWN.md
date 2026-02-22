# HarmonyOS NEXT 节拍器 — 任务分解

## task_id: 20260223-harmony-metronome

## TODO 列表

### TODO-1: 项目脚手架 + 资源 + PreferencesManager
- **目标**: 创建完整 HarmonyOS NEXT Stage 模型工程结构，复制语音 WAV 资源，实现偏好存储模块
- **验收标准**:
  1. 项目根目录结构完整（build-profile.json5, hvigor-config.json5, AppScope/, entry/）
  2. build-profile.json5 配置 compatibleSdkVersion: "5.0.0(12)", runtimeOS: "HarmonyOS"
  3. hvigor-config.json5 使用 modelVersion: "5.0.0"
  4. voice WAV 文件已复制到 entry/src/main/resources/rawfile/voice/{en,zh,ja}/
  5. 图标使用分层配置（foreground.png + background.png + layered-image JSON）
  6. startWindowIcon 使用普通 PNG（非分层图标）
  7. EntryAbility.ts 正确实现，加载 pages/Index
  8. PreferencesManager.ts 实现所有键的读写（bpm, meter_numerator, meter_denominator, accent_bitmask, language, first_beat_only, voice_offset_ms）
  9. main_pages.json 配置页面路由
- **涉及文件**:
  - build-profile.json5（根）
  - hvigor/hvigor-config.json5
  - hvigorfile.ts（根）
  - oh-package.json5（根）
  - AppScope/app.json5
  - AppScope/resources/base/element/string.json
  - AppScope/resources/base/media/app_icon.json
  - AppScope/resources/base/media/foreground.png
  - AppScope/resources/base/media/background.png
  - entry/build-profile.json5
  - entry/hvigorfile.ts
  - entry/oh-package.json5
  - entry/src/main/module.json5
  - entry/src/main/ets/entryability/EntryAbility.ts
  - entry/src/main/ets/data/PreferencesManager.ts
  - entry/src/main/resources/base/element/string.json
  - entry/src/main/resources/base/element/color.json
  - entry/src/main/resources/base/media/icon.json
  - entry/src/main/resources/base/media/foreground.png
  - entry/src/main/resources/base/media/background.png
  - entry/src/main/resources/base/media/startIcon.png
  - entry/src/main/resources/base/profile/main_pages.json
  - entry/src/main/resources/rawfile/voice/en/{1-12}.wav
  - entry/src/main/resources/rawfile/voice/zh/{1-12}.wav
  - entry/src/main/resources/rawfile/voice/ja/{1-12}.wav
- **状态**: 待执行
- **依赖**: 无

### TODO-2: VoiceSampleBank + MetronomeEngine
- **目标**: 实现 WAV 文件解析/PCM 提取/线性插值重采样 + 帧级节拍调度引擎（click 生成、voice 混合、相位连续 BPM 切换）
- **验收标准**:
  1. VoiceSampleBank 能从 rawfile 加载 WAV 并解析为 Float32 PCM 数组
  2. 线性插值重采样正确（支持任意源采样率到流采样率的转换）
  3. 支持三语（en/zh/ja）缓存
  4. MetronomeEngine 使用帧索引调度节拍（nextBeatFrame 机制）
  5. Accent click: 1000Hz, 0.8 振幅, ~30ms 衰减
  6. Normal click: 800Hz, 0.5 振幅, ~30ms 衰减
  7. Voice 混合支持偏移量（-200ms ~ +200ms）
  8. 支持"仅首拍"模式
  9. BPM 切换相位连续（不跳拍）
  10. 重音 bitmask 控制
- **涉及文件**:
  - entry/src/main/ets/audio/VoiceSampleBank.ts
  - entry/src/main/ets/audio/MetronomeEngine.ts
- **状态**: 待执行
- **依赖**: TODO-1

### TODO-3: AudioOutputService + BackgroundPlayService
- **目标**: AudioRenderer callback 模式封装（Float32/Mono）+ 长时任务保活与通知栏控制
- **验收标准**:
  1. AudioRenderer 使用 callback 模式（onWriteData 回调）
  2. 配置: Float32, Mono, 流采样率由系统决定
  3. callback 中调用 MetronomeEngine.renderAudio() 填充缓冲区
  4. 正确的 start/stop 生命周期管理
  5. BackgroundPlayService 使用 AUDIO_PLAYBACK 类型长时任务
  6. 通知栏支持：暂停/继续、停止、BPM+5 操作
  7. 正确的申请/释放逻辑
- **涉及文件**:
  - entry/src/main/ets/audio/AudioOutputService.ts
  - entry/src/main/ets/service/BackgroundPlayService.ts
- **状态**: 待执行
- **依赖**: TODO-2

### TODO-4: MetronomeViewModel + MetronomePage + 最终集成
- **目标**: 状态管理中枢 + 完整 ArkUI 界面 + module.json5 权限/后台模式配置
- **验收标准**:
  1. MetronomeViewModel 持有所有 UI 状态（BPM/拍号/重音/语言/偏移/播放状态）
  2. 状态双向同步到引擎参数
  3. 冷启动时从 Preferences 恢复状态
  4. 状态变更时自动持久化
  5. UI 布局完整：BPM 区域（显示+滑块+微调按钮）、播放按钮、拍号区域（预设+自定义）、重音圆点、语音设置
  6. 播放按钮切换时变色反馈
  7. 重音圆点可点击切换
  8. module.json5 声明 ohos.permission.KEEP_BACKGROUND_RUNNING 权限
  9. module.json5 配置 backgroundModes: ["audioPlayback"]
- **涉及文件**:
  - entry/src/main/ets/viewmodel/MetronomeViewModel.ts
  - entry/src/main/ets/pages/Index.ets
  - entry/src/main/module.json5（更新权限和后台模式）
- **状态**: 待执行
- **依赖**: TODO-3

## 依赖关系
TODO-1 → TODO-2 → TODO-3 → TODO-4（全部串行）
