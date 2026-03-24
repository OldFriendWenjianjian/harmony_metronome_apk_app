import { UIAbility, Want, AbilityConstant, common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { resolveTheme } from '../theme/AppTheme';

const TAG: string = '[Metronome]';
const DOMAIN: number = 0x0000;
const COLOR_MODE_DARK: number = 0;

export default class EntryAbility extends UIAbility {
  private mainWindow: window.Window | null = null;

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(DOMAIN, TAG, 'Ability onCreate');
    AppStorage.setOrCreate<common.UIAbilityContext>('uiAbilityContext', this.context);
    AppStorage.setOrCreate<boolean>('isDarkMode', this.isDarkMode(this.context.config.colorMode));
  }

  onDestroy(): void {
    hilog.info(DOMAIN, TAG, 'Ability onDestroy');
    this.mainWindow = null;
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(DOMAIN, TAG, 'Ability onWindowStageCreate');
    try {
      this.mainWindow = windowStage.getMainWindowSync();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      hilog.error(DOMAIN, TAG, 'Failed to obtain main window: %{public}s', message);
      this.mainWindow = null;
    }
    this.applyWindowTheme(this.isDarkMode(this.context.config.colorMode)).catch((err: Error): void => {
      hilog.error(DOMAIN, TAG, 'Failed to apply window theme: %{public}s', err.message);
    });
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'Failed to load content, code=%{public}d, message=%{public}s',
          err.code, err.message ?? 'unknown');
        return;
      }
      hilog.info(DOMAIN, TAG, 'Content loaded successfully');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(DOMAIN, TAG, 'Ability onWindowStageDestroy');
    this.mainWindow = null;
  }

  onForeground(): void {
    hilog.info(DOMAIN, TAG, 'Ability onForeground');
  }

  onBackground(): void {
    hilog.info(DOMAIN, TAG, 'Ability onBackground');
  }

  onConfigurationUpdate(newConfig: { colorMode?: number }): void {
    const isDarkMode = this.isDarkMode(newConfig.colorMode);
    AppStorage.setOrCreate<boolean>('isDarkMode', isDarkMode);
    this.applyWindowTheme(isDarkMode).catch((err: Error): void => {
      hilog.error(DOMAIN, TAG, 'Failed to update window theme: %{public}s', err.message);
    });
  }

  private isDarkMode(colorMode?: number): boolean {
    return colorMode === COLOR_MODE_DARK;
  }

  private async applyWindowTheme(isDarkMode: boolean): Promise<void> {
    if (this.mainWindow === null) {
      return;
    }
    const theme = resolveTheme(isDarkMode);
    try {
      await this.mainWindow.setWindowSystemBarProperties({
        statusBarColor: theme.systemBarBg,
        statusBarContentColor: theme.systemBarContent,
        navigationBarColor: theme.systemBarBg,
        navigationBarContentColor: theme.systemBarContent
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`setWindowSystemBarProperties failed: ${message}`);
    }
  }
}
