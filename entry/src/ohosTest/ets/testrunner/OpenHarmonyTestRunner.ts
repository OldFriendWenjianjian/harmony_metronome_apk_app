import { TestRunner, abilityDelegatorRegistry } from '@kit.TestKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { BusinessError } from '@kit.BasicServicesKit';

const TAG: string = '[MetronomeTestRunner]';
const DOMAIN: number = 0x0000;

let abilityDelegator: abilityDelegatorRegistry.AbilityDelegator;
let abilityDelegatorArguments: abilityDelegatorRegistry.AbilityDelegatorArgs;

async function onAbilityCreateCallback(): Promise<void> {
  hilog.info(DOMAIN, TAG, 'onAbilityCreateCallback');
}

async function addAbilityMonitorCallback(err: BusinessError): Promise<void> {
  hilog.info(DOMAIN, TAG, 'addAbilityMonitorCallback, err: %{public}s', JSON.stringify(err) ?? 'undefined');
}

export default class OpenHarmonyTestRunner implements TestRunner {
  constructor() {
  }

  onPrepare(): void {
    hilog.info(DOMAIN, TAG, 'OpenHarmonyTestRunner onPrepare');
  }

  async onRun(): Promise<void> {
    hilog.info(DOMAIN, TAG, 'OpenHarmonyTestRunner onRun');
    abilityDelegatorArguments = abilityDelegatorRegistry.getArguments();
    abilityDelegator = abilityDelegatorRegistry.getAbilityDelegator();

    const bundleName = abilityDelegatorArguments.bundleName;
    const testAbilityName = 'TestAbility';
    const monitor: abilityDelegatorRegistry.AbilityMonitor = {
      abilityName: testAbilityName,
      onAbilityCreate: onAbilityCreateCallback
    };
    abilityDelegator.addAbilityMonitor(monitor, addAbilityMonitorCallback);

    const want: Record<string, string> = {
      bundleName: bundleName,
      abilityName: testAbilityName
    };
    abilityDelegator.startAbility(want, (err: BusinessError) => {
      hilog.info(DOMAIN, TAG, 'startAbility err: %{public}s', JSON.stringify(err) ?? 'undefined');
    });
    hilog.info(DOMAIN, TAG, 'OpenHarmonyTestRunner onRun end');
  }
}
