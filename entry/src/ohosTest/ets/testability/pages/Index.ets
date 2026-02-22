import { hilog } from '@kit.PerformanceAnalysisKit';
import testsuite from '../../test/List.test';
import { Hypium } from '@ohos/hypium';

const TAG: string = '[MetronomeTest]';
const DOMAIN: number = 0x0000;

@Entry
@Component
struct Index {
  aboutToAppear(): void {
    hilog.info(DOMAIN, TAG, 'TestAbility Index aboutToAppear');
    Hypium.hypiumTest(this, testsuite);
  }

  build() {
    Column() {
      Text('Metronome Test Page')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .margin(20)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
