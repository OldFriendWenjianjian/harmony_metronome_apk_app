# Code Review 结果

结论：不通过（信息不足）
风险等级：中

---

## 修复任务列表

以下每个任务独立可执行，按严重度从高到低排列。

### FIX-1 [P1] 缺少变更目标与测试计划

**文件**：`N/A`
**位置**：`N/A`

**问题**：
未提供本次变更目标、影响范围、测试计划与风险约束，无法验证需求一致性与回归范围。

**影响**：
可能遗漏关键验证场景，导致功能回归或性能/权限问题在上线后暴露。

**修复方案**：
补充变更目标、影响范围、风险约束与可执行测试计划（至少 1 条命令或手工步骤），并在评审中同步。

**上下文代码**：
```
// N/A
```

**参考实现**：
```
// N/A
```

**验证方式**：
提供并执行对应测试命令或手工步骤，输出通过结果。

---

### FIX-2 [P1] 启动后首拍被延迟一个节拍

**文件**：`entry/src/main/ets/audio/AudioOutputService.ts`
**位置**：`start()` 方法第 114-116 行附近

**问题**：
`start()` 先 `prepare()` 再 `reset()`，`reset()` 会将 `lastBpm`/`lastMeter*` 置零，导致下一次 `renderAudio()` 触发参数变更逻辑，将 `nextBeatFrame` 设为 “当前帧 + 一拍”，首拍被延迟。

**影响**：
启动后首拍听感延迟，节拍进入不在第 0 帧，影响节拍对齐与用户体验。

**修复方案**：
在 `start()` 中先 `reset()` 再 `prepare()`，或在 `reset()` 中保留 `lastBpm/lastMeter*` 并将 `nextBeatFrame` 固定为 0，以保证首拍从第 0 帧触发。

**上下文代码**：
```ts
    this.engine.prepare();
    this.engine.reset();

    try {
      await this.renderer.start();
    } catch (e) {
```

**参考实现**：
```ts
    this.engine.reset();
    this.engine.prepare();

    try {
      await this.renderer.start();
    } catch (e) {
```

**验证方式**：
启动播放后记录首拍触发时间（或在 `BeatCallback` 打点），确认首拍在第 0 帧或第一个 buffer 内触发，无额外一拍延迟。

---

### FIX-3 [P1] 音频回调线程直接更新 UI 状态

**文件**：`entry/src/main/ets/viewmodel/MetronomeViewModel.ts`
**位置**：`init()` 方法 `engine.onBeat(...)` 回调第 75-78 行附近

**问题**：
`engine.onBeat` 回调在音频渲染线程中触发，回调内直接更新 `currentBeatIndex` 并触发 UI 状态同步，违反 UI 线程约束，存在竞态与线程安全风险。

**影响**：
可能导致 UI 线程崩溃、状态错乱或卡顿；在高负载下更易出现非确定性问题。

**修复方案**：
将 beat 事件派发到主线程执行。推荐使用 `UIAbilityContext.getMainTaskDispatcher().asyncDispatch` 或通过事件队列/定时器在 UI 线程读取最新 beat 值。

**上下文代码**：
```ts
      if (engine !== null) {
        engine.updateParams(this.buildEngineParams());
        engine.onBeat((info: BeatEventInfo) => {
          this.currentBeatIndex = info.beatIndex;
          this.notifyStateChange();
        });
      }
```

**参考实现**：
```ts
      if (engine !== null) {
        engine.updateParams(this.buildEngineParams());
        const dispatcher = this.context?.getMainTaskDispatcher();
        engine.onBeat((info: BeatEventInfo) => {
          if (!dispatcher) {
            return;
          }
          dispatcher.asyncDispatch(() => {
            this.currentBeatIndex = info.beatIndex;
            this.notifyStateChange();
          });
        });
      }
```

**验证方式**：
开启播放并持续切换前后台、调整 BPM，观察 UI 更新是否稳定；同时确认无线程相关报错或崩溃日志。

---

### FIX-4 [P1] 音频回调内存在动态分配与 Map 查找

**文件**：`entry/src/main/ets/audio/MetronomeEngine.ts`
**位置**：`renderAudio()` 与 `collectVoiceTriggers()` 方法第 118-166、242-301 行附近

**问题**：
音频回调每次调用都会创建 `Map` 并进行多次 `get` 查找，产生对象分配与 GC 压力，不满足“零分配”音频回调要求。

**影响**：
在低端设备或负载高时可能造成音频抖动/丢帧，影响节拍稳定性。

**修复方案**：
在引擎内预分配触发结构，避免 `Map` 分配；可维护“下一次语音触发帧”并在渲染循环中直接比较 `globalFrame`，或使用固定长度数组作为触发表。

**上下文代码**：
```ts
    // Collect voice triggers for this buffer window (including lookahead for negative offset)
    const voiceTriggers = this.collectVoiceTriggers(frames);

    for (let i = 0; i < frames; i++) {
      let sample: number = 0.0;
      const globalFrame = this.totalFramesRendered + i;
      // ...
      const trigger = voiceTriggers.get(i);
      if (trigger !== undefined) {
        this.activeVoiceSample = trigger;
        this.voicePlaybackPos = 0;
      }
```

**参考实现**：
```ts
    // Example: keep nextVoiceStartFrame and compare inline (no Map allocation)
    for (let i = 0; i < frames; i++) {
      const globalFrame = this.totalFramesRendered + i;
      if (globalFrame === this.nextVoiceStartFrame) {
        this.activeVoiceSample = this.nextVoiceSample;
        this.voicePlaybackPos = 0;
        this.computeNextVoiceStart(); // updates nextVoiceStartFrame/nextVoiceSample
      }
      // ... mix click and voice
    }
```

**验证方式**：
在持续播放和频繁参数调整下观察音频是否稳定无抖动；对比 GC/CPU 峰值是否下降。

---

### FIX-5 [P2] 停止后台任务失败时状态可能失真

**文件**：`entry/src/main/ets/service/BackgroundPlayService.ts`
**位置**：`stopBackgroundTask()` 方法第 71-80 行附近

**问题**：
`stopBackgroundRunning` 失败时仍将 `running` 置为 `false`，可能与系统实际后台任务状态不一致。

**影响**：
后续调用可能重复启动或错误跳过启动，导致后台播放状态与 UI 逻辑不一致。

**修复方案**：
仅在成功停止后将 `running` 设为 `false`；失败时保留为 `true` 或从系统查询实际状态再更新。

**上下文代码**：
```ts
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      hilog.error(DOMAIN, TAG,
        `stopBackgroundRunning failed: ${err.message}`);
      this.running = false;
      throw new Error(
        `BackgroundPlayService.stopBackgroundTask: stopBackgroundRunning failed: ${err.message}`,
        { cause: err }
      );
    }
```

**参考实现**：
```ts
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      hilog.error(DOMAIN, TAG,
        `stopBackgroundRunning failed: ${err.message}`);
      // keep running=true or query actual status
      throw new Error(
        `BackgroundPlayService.stopBackgroundTask: stopBackgroundRunning failed: ${err.message}`,
        { cause: err }
      );
    }

    this.running = false;
```

**验证方式**：
模拟 `stopBackgroundRunning` 失败场景，确认 `running` 状态与系统后台任务状态一致。

---

### FIX-6 [P2] WAV data chunk 长度未校验导致潜在截断

**文件**：`entry/src/main/ets/audio/VoiceSampleBank.ts`
**位置**：`parseWav()` 方法第 148-181 行附近

**问题**：
解析 `data` chunk 时未校验 `dataOffset + dataSize` 是否越界，后续用 `Math.min` 截断处理，可能掩盖损坏文件并产生异常音频数据。

**影响**：
资源文件损坏时无法明确报错，可能输出噪声或不完整语音，影响用户体验与排障效率。

**修复方案**：
在读取 `data` chunk 后显式校验长度，越界时直接抛错，避免静默截断。

**上下文代码**：
```ts
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

  const availableBytes = Math.min(dataSize, data.length - dataOffset);
```

**参考实现**：
```ts
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      if (dataOffset + dataSize > data.length) {
        throw new Error(`data chunk overflows file in '${sourcePath}'`);
      }
      break;
    }
```

**验证方式**：
使用故意截断的 WAV 文件进行加载，确认抛出明确错误并停止初始化。

---

## 修复优先级

必须修复（不修复则不通过）：FIX-1, FIX-2, FIX-3, FIX-4
建议修复（提升质量）：FIX-5, FIX-6
