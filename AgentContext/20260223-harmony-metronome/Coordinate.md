# Coordinate — 20260223-harmony-metronome

## 最小上下文

- **需求**: 开发一个 HarmonyOS NEXT 节拍器应用，支持多语言语音报拍、自定义拍号与重音、后台播放
- **目标**: 完成 4 个串行 TODO，从脚手架搭建到最终集成
- **范围**: 完整 Stage 模型工程，含音频引擎、后台服务、UI 页面

## 关键决定与约定

- **项目结构**: HarmonyOS NEXT Stage 模型，compatibleSdkVersion "5.0.0(12)"
- **音频方案**: AudioRenderer callback 模式，Float32/Mono
- **采样率**: 由系统决定流采样率，VoiceSampleBank 做线性插值重采样
- **持久化**: @ohos.data.preferences 存储用户设置
- **后台保活**: AUDIO_PLAYBACK 类型长时任务
- **Memory 文件位置**: `Memory/20260223-harmony-metronome.md`
- **协作文档位置**: `AgentContext/20260223-harmony-metronome/`

## 并行任务分组

无并行组。所有 TODO 串行执行。

## 文件所有权

全部 TODO 串行，无需声明独占文件。

## 待补充清单

（暂无）

## TODO-2 实现记录

### 公开接口约定（供 TODO-3/4 使用）

**VoiceSampleBank** (`entry/src/main/ets/audio/VoiceSampleBank.ts`):
- `init(resMgr: resourceManager.ResourceManager, streamSampleRate: number): Promise<void>` — 加载全部 36 个 WAV 到内存
- `getSample(language: string, beatNumber: number): Float32Array | null` — 同步获取缓存样本，beatNumber 1-based
- `setStreamSampleRate(resMgr, newRate): Promise<void>` — 动态切换采样率并重采样
- `isReady(): boolean`

**MetronomeEngine** (`entry/src/main/ets/audio/MetronomeEngine.ts`):
- `constructor(sampleRate: number)`
- `setVoiceSampleBank(bank: VoiceSampleBank): void`
- `updateParams(params: EngineParams): void` — 可在播放中调用，相位连续
- `prepare(): void` — 预计算 click 波形，设置初始 framesPerBeat
- `renderAudio(buffer: Float32Array, numFrames: number): void` — 由 AudioRenderer callback 调用
- `reset(): void` — 停止时调用
- `onBeat(callback: BeatCallback): void` — 注册节拍回调（UI 用）
- `getCurrentBeat(): number`

### 关键设计决策

- WAV 解析器手动扫描 chunks（跳过 LIST/fact 等），不依赖固定偏移
- 保留原始 PCM 数据在 rawCache 中，切换采样率时不需重新读 rawfile
- Voice 触发使用 collectVoiceTriggers 预扫描机制，支持负偏移 lookahead（最大 0.2s 或偏移量取较大值）
- 新 voice 触发时截断旧 voice（不叠加），避免多声道混乱
- renderAudio 内部零 I/O，所有数据预加载
- BPM/meterDenominator 变化时重算 framesPerBeat 并 nextBeatFrame = totalFramesRendered + newFramesPerBeat（相位连续）

## TODO-3 实现记录

### 公开接口约定（供 TODO-4 使用）

**AudioOutputService** (`entry/src/main/ets/audio/AudioOutputService.ts`):
- `init(context: common.UIAbilityContext): Promise<void>` — 创建 AudioRenderer (callback/F32/Mono/48kHz)、MetronomeEngine、VoiceSampleBank 并完成初始化
- `getEngine(): MetronomeEngine | null` — 获取引擎引用，供 ViewModel 调用 updateParams/onBeat
- `getVoiceBank(): VoiceSampleBank | null` — 获取语音样本库引用
- `getSampleRate(): number` — 返回实际流采样率
- `start(): Promise<void>` — 调用 engine.prepare() + reset() 后启动 renderer
- `stop(): Promise<void>` — 停止 renderer 并 reset engine
- `release(): Promise<void>` — 释放所有资源
- `isPlaying(): boolean` — 状态查询

**BackgroundPlayService** (`entry/src/main/ets/service/BackgroundPlayService.ts`):
- `startBackgroundTask(context: common.UIAbilityContext): Promise<void>` — 申请 AUDIO_PLAYBACK 长时任务
- `stopBackgroundTask(context: common.UIAbilityContext): Promise<void>` — 释放长时任务
- `isRunning(): boolean` — 状态查询

### 关键设计决策

- AudioRenderer 使用 writeData callback 模式，在回调中零分配地填充 Float32Array
- 采样率通过 renderer.getAudioStreamInfo() 获取实际值，fallback 到 48000Hz
- init 时即完成 VoiceSampleBank 加载和 Engine 绑定，start 时只做 prepare/reset/start
- writeData 回调内捕获 engine 引用（engineRef）避免闭包捕获 this 带来的可空性问题
- BackgroundPlayService 的 WantAgent 指向 EntryAbility，通知栏点击回到主界面
- 两个服务均为无状态单例风格（由 ViewModel 持有实例），生命周期跟随页面/Ability
- module.json5 的 requestPermissions (KEEP_BACKGROUND_RUNNING) 和 backgroundModes (audioPlayback) 由 TODO-4 集成时配置
