import { common } from '@kit.AbilityKit';
import { MetronomeViewModel } from '../viewmodel/MetronomeViewModel';

const BG_COLOR: string = '#1A1A2E';
const CARD_BG: string = '#16213E';
const ACCENT: string = '#E94560';
const TEXT_PRIMARY: string = '#FFFFFF';
const TEXT_SECONDARY: string = '#8899AA';
const PLAY_GREEN: string = '#4CAF50';
const DOT_NORMAL: string = '#3A4A6A';
const DOT_HIGHLIGHT: string = '#FFD700';
const CHIP_SELECTED: string = '#0F3460';
const CHIP_UNSELECTED: string = '#2A3A5A';

@Entry
@Component
struct Index {
  private vm: MetronomeViewModel = new MetronomeViewModel();

  @State bpm: number = 120;
  @State meterNumerator: number = 4;
  @State meterDenominator: number = 4;
  @State accentBitmask: number = 0x1;
  @State lang: string = 'en';
  @State firstBeatOnly: boolean = true;
  @State voiceOffsetMs: number = 0;
  @State playing: boolean = false;
  @State curBeat: number = -1;

  aboutToAppear(): void {
    this.vm.setOnStateChange((): void => {
      this.syncState();
    });
    this.syncState();
    const ctx = AppStorage.get<common.UIAbilityContext>('uiAbilityContext');
    if (ctx !== undefined) {
      this.vm.init(ctx).catch((_: Object): void => {});
    }
  }

  aboutToDisappear(): void {
    this.vm.destroy().catch((_: Object): void => {});
  }

  private syncState(): void {
    this.bpm = this.vm.bpm;
    this.meterNumerator = this.vm.meterNumerator;
    this.meterDenominator = this.vm.meterDenominator;
    this.accentBitmask = this.vm.accentBitmask;
    this.lang = this.vm.language;
    this.firstBeatOnly = this.vm.firstBeatOnly;
    this.voiceOffsetMs = this.vm.voiceOffsetMs;
    this.playing = this.vm.isPlaying;
    this.curBeat = this.vm.currentBeatIndex;
  }

  private beatArray(): number[] {
    const arr: number[] = [];
    for (let i: number = 0; i < this.meterNumerator; i++) {
      arr.push(i);
    }
    return arr;
  }

  build() {
    Column() {
      Scroll() {
        Column({ space: 16 }) {
          Text('Harmony Metronome')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor(TEXT_PRIMARY)

          this.BpmSection()
          this.PlaySection()
          this.MeterSection()
          this.AccentSection()
          this.VoiceSection()
        }
        .width('100%')
        .padding({ left: 16, right: 16, top: 24, bottom: 40 })
      }
      .scrollable(ScrollDirection.Vertical)
      .edgeEffect(EdgeEffect.Spring)
      .width('100%')
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(BG_COLOR)
  }

  // ── BPM display, adjustment buttons, and slider ──────────────────────

  @Builder
  BpmSection() {
    Column() {
      Text('BPM')
        .fontSize(14)
        .fontColor(TEXT_SECONDARY)

      Text(this.bpm.toString())
        .fontSize(64)
        .fontWeight(FontWeight.Bold)
        .fontColor(TEXT_PRIMARY)
        .margin({ top: 2, bottom: 12 })

      Row({ space: 12 }) {
        Button('-5')
          .fontSize(16).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
          .borderRadius(8).width(56).height(36)
          .onClick((): void => { this.vm.adjustBpm(-5); this.syncState(); })
        Button('-1')
          .fontSize(16).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
          .borderRadius(8).width(56).height(36)
          .onClick((): void => { this.vm.adjustBpm(-1); this.syncState(); })
        Button('+1')
          .fontSize(16).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
          .borderRadius(8).width(56).height(36)
          .onClick((): void => { this.vm.adjustBpm(1); this.syncState(); })
        Button('+5')
          .fontSize(16).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
          .borderRadius(8).width(56).height(36)
          .onClick((): void => { this.vm.adjustBpm(5); this.syncState(); })
      }
      .margin({ bottom: 16 })

      Slider({
        value: this.bpm,
        min: 30,
        max: 300,
        step: 1,
        style: SliderStyle.OutSet
      })
        .trackColor(DOT_NORMAL)
        .selectedColor(ACCENT)
        .blockColor(TEXT_PRIMARY)
        .onChange((value: number): void => {
          this.vm.setBpm(value);
          this.syncState();
        })
    }
    .width('100%')
    .padding(16)
    .backgroundColor(CARD_BG)
    .borderRadius(16)
    .alignItems(HorizontalAlign.Center)
  }

  // ── Play / Stop circular button ──────────────────────────────────────

  @Builder
  PlaySection() {
    Column() {
      Button() {
        Text(this.playing ? '\u25A0' : '\u25B6')
          .fontSize(40)
          .fontColor(TEXT_PRIMARY)
      }
      .width(100)
      .height(100)
      .borderRadius(50)
      .backgroundColor(this.playing ? ACCENT : PLAY_GREEN)
      .shadow({ radius: 16, color: this.playing ? ACCENT : PLAY_GREEN, offsetX: 0, offsetY: 0 })
      .onClick((): void => {
        this.vm.togglePlay().catch((_: Object): void => {});
      })

      Text(this.playing ? 'STOP' : 'PLAY')
        .fontSize(12)
        .fontColor(TEXT_SECONDARY)
        .margin({ top: 8 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }

  // ── Time signature presets and custom controls ───────────────────────

  @Builder
  MeterSection() {
    Column() {
      Text('Time Signature')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(TEXT_PRIMARY)
        .margin({ bottom: 12 })

      Row({ space: 8 }) {
        Button('2/4')
          .fontSize(14).fontColor(TEXT_PRIMARY).borderRadius(16).height(32)
          .padding({ left: 16, right: 16 })
          .backgroundColor(this.meterNumerator === 2 && this.meterDenominator === 4
            ? CHIP_SELECTED : CHIP_UNSELECTED)
          .border({
            width: this.meterNumerator === 2 && this.meterDenominator === 4 ? 1 : 0,
            color: ACCENT
          })
          .onClick((): void => { this.vm.setMeterPreset(2, 4); this.syncState(); })
        Button('3/4')
          .fontSize(14).fontColor(TEXT_PRIMARY).borderRadius(16).height(32)
          .padding({ left: 16, right: 16 })
          .backgroundColor(this.meterNumerator === 3 && this.meterDenominator === 4
            ? CHIP_SELECTED : CHIP_UNSELECTED)
          .border({
            width: this.meterNumerator === 3 && this.meterDenominator === 4 ? 1 : 0,
            color: ACCENT
          })
          .onClick((): void => { this.vm.setMeterPreset(3, 4); this.syncState(); })
        Button('4/4')
          .fontSize(14).fontColor(TEXT_PRIMARY).borderRadius(16).height(32)
          .padding({ left: 16, right: 16 })
          .backgroundColor(this.meterNumerator === 4 && this.meterDenominator === 4
            ? CHIP_SELECTED : CHIP_UNSELECTED)
          .border({
            width: this.meterNumerator === 4 && this.meterDenominator === 4 ? 1 : 0,
            color: ACCENT
          })
          .onClick((): void => { this.vm.setMeterPreset(4, 4); this.syncState(); })
        Button('6/8')
          .fontSize(14).fontColor(TEXT_PRIMARY).borderRadius(16).height(32)
          .padding({ left: 16, right: 16 })
          .backgroundColor(this.meterNumerator === 6 && this.meterDenominator === 8
            ? CHIP_SELECTED : CHIP_UNSELECTED)
          .border({
            width: this.meterNumerator === 6 && this.meterDenominator === 8 ? 1 : 0,
            color: ACCENT
          })
          .onClick((): void => { this.vm.setMeterPreset(6, 8); this.syncState(); })
      }
      .justifyContent(FlexAlign.Center)
      .margin({ bottom: 16 })

      Row() {
        Column() {
          Text('Beats')
            .fontSize(12)
            .fontColor(TEXT_SECONDARY)
            .margin({ bottom: 6 })

          Row({ space: 8 }) {
            Button('-')
              .fontSize(18).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
              .width(36).height(36).borderRadius(18)
              .onClick((): void => {
                this.vm.setMeterNumerator(this.meterNumerator - 1);
                this.syncState();
              })
            Text(this.meterNumerator.toString())
              .fontSize(24).fontWeight(FontWeight.Bold).fontColor(TEXT_PRIMARY)
              .width(40).textAlign(TextAlign.Center)
            Button('+')
              .fontSize(18).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
              .width(36).height(36).borderRadius(18)
              .onClick((): void => {
                this.vm.setMeterNumerator(this.meterNumerator + 1);
                this.syncState();
              })
          }
          .alignItems(VerticalAlign.Center)
        }
        .alignItems(HorizontalAlign.Center)

        Text('/')
          .fontSize(32)
          .fontColor(TEXT_SECONDARY)
          .margin({ left: 20, right: 20 })

        Column() {
          Text('Note')
            .fontSize(12)
            .fontColor(TEXT_SECONDARY)
            .margin({ bottom: 6 })

          Row({ space: 8 }) {
            Button('-')
              .fontSize(18).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
              .width(36).height(36).borderRadius(18)
              .onClick((): void => { this.vm.prevDenominator(); this.syncState(); })
            Text(this.meterDenominator.toString())
              .fontSize(24).fontWeight(FontWeight.Bold).fontColor(TEXT_PRIMARY)
              .width(40).textAlign(TextAlign.Center)
            Button('+')
              .fontSize(18).fontColor(TEXT_PRIMARY).backgroundColor(CHIP_UNSELECTED)
              .width(36).height(36).borderRadius(18)
              .onClick((): void => { this.vm.nextDenominator(); this.syncState(); })
          }
          .alignItems(VerticalAlign.Center)
        }
        .alignItems(HorizontalAlign.Center)
      }
      .width('100%')
      .justifyContent(FlexAlign.Center)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(CARD_BG)
    .borderRadius(16)
    .alignItems(HorizontalAlign.Center)
  }

  // ── Clickable accent dots per beat ───────────────────────────────────

  @Builder
  AccentSection() {
    Column() {
      Text('Accent Pattern')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(TEXT_PRIMARY)
        .margin({ bottom: 12 })

      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center }) {
        ForEach(
          this.beatArray(),
          (idx: number) => {
            Column() {
              Text((idx + 1).toString())
                .fontSize(12)
                .fontColor(
                  this.curBeat === idx ? DOT_HIGHLIGHT
                    : ((this.accentBitmask >>> idx) & 1) === 1 ? ACCENT
                    : TEXT_SECONDARY
                )
                .margin({ bottom: 4 })

              Column()
                .width(((this.accentBitmask >>> idx) & 1) === 1 ? 40 : 30)
                .height(((this.accentBitmask >>> idx) & 1) === 1 ? 40 : 30)
                .borderRadius(((this.accentBitmask >>> idx) & 1) === 1 ? 20 : 15)
                .backgroundColor(
                  this.curBeat === idx ? DOT_HIGHLIGHT
                    : ((this.accentBitmask >>> idx) & 1) === 1 ? ACCENT
                    : DOT_NORMAL
                )
                .shadow({
                  radius: this.curBeat === idx ? 12 : 0,
                  color: DOT_HIGHLIGHT,
                  offsetX: 0,
                  offsetY: 0
                })
            }
            .alignItems(HorizontalAlign.Center)
            .margin(6)
            .onClick((): void => {
              this.vm.toggleAccent(idx);
              this.syncState();
            })
          },
          (idx: number): string => `${idx}_${this.accentBitmask}_${this.curBeat}`
        )
      }
      .width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor(CARD_BG)
    .borderRadius(16)
  }

  // ── Language selection, first-beat toggle, voice offset ──────────────

  @Builder
  VoiceSection() {
    Column() {
      Text('Voice Count')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(TEXT_PRIMARY)
        .margin({ bottom: 12 })

      Row({ space: 12 }) {
        Button('EN')
          .fontSize(16).fontColor(TEXT_PRIMARY).borderRadius(16).width(64).height(36)
          .backgroundColor(this.lang === 'en' ? CHIP_SELECTED : CHIP_UNSELECTED)
          .border({ width: this.lang === 'en' ? 1 : 0, color: ACCENT })
          .onClick((): void => { this.vm.setLanguage('en'); this.syncState(); })
        Button('\u4E2D')
          .fontSize(16).fontColor(TEXT_PRIMARY).borderRadius(16).width(64).height(36)
          .backgroundColor(this.lang === 'zh' ? CHIP_SELECTED : CHIP_UNSELECTED)
          .border({ width: this.lang === 'zh' ? 1 : 0, color: ACCENT })
          .onClick((): void => { this.vm.setLanguage('zh'); this.syncState(); })
        Button('\u65E5')
          .fontSize(16).fontColor(TEXT_PRIMARY).borderRadius(16).width(64).height(36)
          .backgroundColor(this.lang === 'ja' ? CHIP_SELECTED : CHIP_UNSELECTED)
          .border({ width: this.lang === 'ja' ? 1 : 0, color: ACCENT })
          .onClick((): void => { this.vm.setLanguage('ja'); this.syncState(); })
      }
      .justifyContent(FlexAlign.Center)
      .margin({ bottom: 16 })

      Row() {
        Text('First beat only')
          .fontSize(14)
          .fontColor(TEXT_PRIMARY)
        Blank()
        Toggle({ type: ToggleType.Switch, isOn: this.firstBeatOnly })
          .selectedColor(ACCENT)
          .onChange((isOn: boolean): void => {
            this.vm.setFirstBeatOnly(isOn);
            this.syncState();
          })
      }
      .width('100%')
      .padding({ left: 4, right: 4 })
      .margin({ bottom: 16 })

      Row() {
        Text('Voice Offset')
          .fontSize(14)
          .fontColor(TEXT_PRIMARY)
        Blank()
        Text(`${this.voiceOffsetMs > 0 ? '+' : ''}${this.voiceOffsetMs}ms`)
          .fontSize(14)
          .fontColor(TEXT_SECONDARY)
      }
      .width('100%')
      .padding({ left: 4, right: 4 })
      .margin({ bottom: 8 })

      Slider({
        value: this.voiceOffsetMs,
        min: -200,
        max: 200,
        step: 10,
        style: SliderStyle.OutSet
      })
        .trackColor(DOT_NORMAL)
        .selectedColor(ACCENT)
        .blockColor(TEXT_PRIMARY)
        .onChange((value: number): void => {
          this.vm.setVoiceOffsetMs(value);
          this.syncState();
        })
    }
    .width('100%')
    .padding(16)
    .backgroundColor(CARD_BG)
    .borderRadius(16)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.None, duration: 300 })
      .slide(SlideEffect.Bottom)
      .opacity(0)
    PageTransitionExit({ type: RouteType.None, duration: 200 })
      .slide(SlideEffect.Bottom)
      .opacity(0)
  }
}
