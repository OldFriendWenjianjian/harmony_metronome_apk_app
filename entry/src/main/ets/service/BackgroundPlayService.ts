import { backgroundTaskManager } from '@kit.BackgroundTasksKit';
import { wantAgent, WantAgent, common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const TAG: string = '[BackgroundPlayService]';
const DOMAIN: number = 0x0000;

const BUNDLE_NAME: string = 'com.example.harmonymetronome';
const ABILITY_NAME: string = 'EntryAbility';

/**
 * Manages an AUDIO_PLAYBACK background running task so the
 * metronome continues to produce audio when the app moves to
 * the background. Wraps backgroundTaskManager start/stop with
 * error handling and state tracking.
 */
export class BackgroundPlayService {
  private running: boolean = false;

  async startBackgroundTask(context: common.UIAbilityContext): Promise<void> {
    if (this.running) {
      hilog.warn(DOMAIN, TAG, 'Background task already running, skipping duplicate start');
      return;
    }

    let agent: WantAgent;
    try {
      const wantAgentInfo: wantAgent.WantAgentInfo = {
        wants: [
          {
            bundleName: BUNDLE_NAME,
            abilityName: ABILITY_NAME
          }
        ],
        actionType: wantAgent.OperationType.START_ABILITY,
        requestCode: 0,
        actionFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG]
      };
      agent = await wantAgent.getWantAgent(wantAgentInfo);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(
        `BackgroundPlayService.startBackgroundTask: failed to create WantAgent: ${err.message}`,
        { cause: err }
      );
    }

    try {
      await backgroundTaskManager.startBackgroundRunning(
        context,
        backgroundTaskManager.BackgroundMode.AUDIO_PLAYBACK,
        agent
      );
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(
        `BackgroundPlayService.startBackgroundTask: startBackgroundRunning failed: ${err.message}`,
        { cause: err }
      );
    }

    this.running = true;
    hilog.info(DOMAIN, TAG, 'Background task started (AUDIO_PLAYBACK)');
  }

  async stopBackgroundTask(context: common.UIAbilityContext): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      await backgroundTaskManager.stopBackgroundRunning(context);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      hilog.error(DOMAIN, TAG,
        `stopBackgroundRunning failed: ${err.message}`);
      throw new Error(
        `BackgroundPlayService.stopBackgroundTask: stopBackgroundRunning failed: ${err.message}`,
        { cause: err }
      );
    }

    this.running = false;
    hilog.info(DOMAIN, TAG, 'Background task stopped');
  }

  isRunning(): boolean {
    return this.running;
  }
}
