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
