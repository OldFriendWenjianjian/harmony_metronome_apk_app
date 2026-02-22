import { hilog } from '@kit.PerformanceAnalysisKit';
import { describe, it, expect } from '@ohos/hypium';

const TAG: string = '[MetronomeTest]';
const DOMAIN: number = 0x0000;

export default function abilityTest() {
  describe('AbilityTest', () => {
    it('StartAbility_001', 0, () => {
      hilog.info(DOMAIN, TAG, 'StartAbility_001 begin');
      expect(true).assertTrue();
      hilog.info(DOMAIN, TAG, 'StartAbility_001 end');
    });
  });
}
