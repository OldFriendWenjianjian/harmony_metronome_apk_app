import { common } from '@kit.AbilityKit';
import { APP_NAME, APP_TAGLINE } from '../common/AppInfo';
import { resolveTheme, AppThemePalette } from '../theme/AppTheme';
import { MetronomeViewModel } from '../viewmodel/MetronomeViewModel';

@Entry
@Component
struct Index {
  private vm: MetronomeViewModel = new MetronomeViewModel();
  private uiContext: common.UIAbilityContext | null = null;

  @StorageProp('isDarkMode') isDarkMode: boolean = false;

  @State bpm: number = 120;
  @State meterNumerator: number = 4;
  @State meterDenominator: number = 4;
  @State accentBitmask: number = 0x1;
  @State lang: string = 'zh';
  @State firstBeatOnly: boolean = true;
  @State voiceOffsetMs: number = 0;
  @State playing: boolean = false;
  @State curBeat: number = -1;
  @State viewModelInitialized: boolean = false;
  @State initInProgress: boolean = false;
  @State initErrorMessage: string = '';

  aboutToAppear(): void {
    this.vm.setOnStateChange((): void => {
      this.syncState();
    });
    this.syncState();

    const ctx = AppStorage.get<common.UIAbilityContext>('uiAbilityContext');
    if (ctx === undefined) {
      this.initErrorMessage = '应用上下文尚未就绪，请重新打开后再试。';
      return;
    }

    this.uiContext = ctx;
    this.ensureViewModelReady().catch((_: Object): void => {});
  }

  aboutToDisappear(): void {
    if (this.viewModelInitialized) {
      this.vm.destroy().catch((_: Object): void => {});
      this.viewModelInitialized = false;
    }
  }

  // 保留外部/系统级的隐私同意，页面内部直接初始化业务。
  private async ensureViewModelReady(): Promise<void> {
    if (this.viewModelInitialized || this.uiContext === null || this.initInProgress) {
      return;
    }

    this.initInProgress = true;
    this.initErrorMessage = '';
    try {
      await this.vm.init(this.uiContext);
      this.viewModelInitialized = true;
      this.syncState();
    } catch (error) {
      this.initErrorMessage = `初始化失败：${this.errorMessageOf(error)}`;
    } finally {
      this.initInProgress = false;
    }
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

  private withVmSync(action: () => void): void {
    action();
    this.syncState();
  }

  private theme(): AppThemePalette {
    return resolveTheme(this.isDarkMode);
  }

  private errorMessageOf(error: Object): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }
    return String(error);
  }

  private beatArray(): number[] {
    const arr: number[] = [];
    for (let i = 0; i < this.meterNumerator; i++) {
      arr.push(i);
    }
    return arr;
  }

  private isBeatAccented(idx: number): boolean {
    return ((this.accentBitmask >>> idx) & 1) === 1;
  }

  private beatIndexColor(idx: number): string {
    const theme = this.theme();
    if (this.curBeat === idx) {
      return theme.currentBeatBg;
    }
    return this.isBeatAccented(idx) ? theme.accentActive : theme.textSecondary;
  }

  private beatBubbleColor(idx: number): string {
    const theme = this.theme();
    if (this.curBeat === idx) {
      return theme.currentBeatBg;
    }
    return this.isBeatAccented(idx) ? theme.accentActive : theme.accentInactive;
  }

  private beatBubbleTextColor(idx: number): string {
    if (this.curBeat === idx || this.isBeatAccented(idx)) {
      return '#FFFFFF';
    }
    return this.theme().textPrimary;
  }

  build() {
    if (this.viewModelInitialized) {
      Column() {
        this.HeaderSection();
        Scroll() {
          Column({ space: 16 }) {
            this.TransportCard();
            this.MeterCard();
            this.AccentCard();
            this.VoiceCard();
          }
          .width('100%')
          .padding({ left: 16, right: 16, top: 8, bottom: 28 })
        }
        .scrollable(ScrollDirection.Vertical)
        .edgeEffect(EdgeEffect.Spring)
        .layoutWeight(1)
        .width('100%')
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme().pageBg)
    } else {
      this.StartupShell();
    }
  }

  @Builder
  StartupShell() {
    Column({ space: 16 }) {
      Text(APP_NAME)
        .fontSize(30)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme().textPrimary)

      Text(APP_TAGLINE)
        .fontSize(15)
        .fontColor(this.theme().textSecondary)
        .textAlign(TextAlign.Center)

      if (this.initErrorMessage.length > 0) {
        Text(this.initErrorMessage)
          .fontSize(13)
          .lineHeight(20)
          .fontColor(this.theme().danger)
          .textAlign(TextAlign.Center)

        Button('重新初始化')
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme().chipActiveText)
          .backgroundColor(this.theme().primary)
          .borderRadius(16)
          .padding({ left: 18, right: 18, top: 12, bottom: 12 })
          .onClick((): void => {
            this.ensureViewModelReady().catch((_: Object): void => {});
          })
      } else {
        LoadingProgress()
          .width(38)
          .height(38)
          .margin({ top: 8 })

        Text(this.initInProgress ? '正在准备节拍器，请稍候…' : '正在载入界面…')
          .fontSize(13)
          .fontColor(this.theme().textMuted)
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .padding(24)
    .backgroundColor(this.theme().pageBg)
  }

  @Builder
  HeaderSection() {
    Column() {
      Row() {
        Column() {
          Text(APP_NAME)
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme().textPrimary)

          Text(APP_TAGLINE)
            .fontSize(13)
            .fontColor(this.theme().textSecondary)
            .margin({ top: 4 })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)

        Text(this.playing ? '播放中' : '已停止')
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.playing ? this.theme().success : this.theme().statusIdleText)
          .padding({ left: 12, right: 12, top: 6, bottom: 6 })
          .backgroundColor(this.playing ? this.theme().statusActiveBg : this.theme().statusIdleBg)
          .borderRadius(16)
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 22, bottom: 8 })
  }

  @Builder
  TransportCard() {
    Column({ space: 16 }) {
      this.CardTitle('速度', 'BPM 微调与播放控制')

      Text(this.bpm.toString())
        .fontSize(60)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme().primary)
        .width('100%')
        .textAlign(TextAlign.Center)

      Text('BPM')
        .fontSize(14)
        .fontColor(this.theme().textSecondary)
        .width('100%')
        .textAlign(TextAlign.Center)

      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center }) {
        this.ActionButton('-5', (): void => {
          this.withVmSync((): void => {
            this.vm.adjustBpm(-5);
          });
        });
        this.ActionButton('-1', (): void => {
          this.withVmSync((): void => {
            this.vm.adjustBpm(-1);
          });
        });
        this.ActionButton('+1', (): void => {
          this.withVmSync((): void => {
            this.vm.adjustBpm(1);
          });
        });
        this.ActionButton('+5', (): void => {
          this.withVmSync((): void => {
            this.vm.adjustBpm(5);
          });
        });
      }
      .width('100%')

      Slider({
        value: this.bpm,
        min: 30,
        max: 300,
        step: 1,
        style: SliderStyle.OutSet
      })
        .trackColor(this.theme().sliderTrack)
        .selectedColor(this.theme().primary)
        .blockColor(this.theme().sliderBlock)
        .onChange((value: number): void => {
          this.withVmSync((): void => {
            this.vm.setBpm(value);
          });
        })

      Row() {
        Text('30')
          .fontSize(12)
          .fontColor(this.theme().textMuted)
        Blank()
        Text('300')
          .fontSize(12)
          .fontColor(this.theme().textMuted)
      }
      .width('100%')

      Button() {
        Text(this.playing ? '停止' : '开始')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
      }
      .width('100%')
      .height(56)
      .borderRadius(18)
      .backgroundColor(this.playing ? this.theme().danger : this.theme().primary)
      .onClick((): void => {
        this.vm.togglePlay()
          .then((): void => {
            this.syncState();
          })
          .catch((_: Object): void => {});
      })
    }
    .width('100%')
    .padding(18)
    .backgroundColor(this.theme().surfaceBg)
    .borderRadius(24)
  }

  @Builder
  MeterCard() {
    // ArkUI 对带动态参数的 @Builder 有复用倾向，直接绑定页面 @State，避免点击后停留旧值。
    Column({ space: 16 }) {
      this.CardTitle('拍号', '常用拍号与自定义拍值')

      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
        Button('2/4')
          .fontSize(14)
          .fontWeight(this.meterNumerator === 2 && this.meterDenominator === 4 ? FontWeight.Bold : FontWeight.Regular)
          .fontColor(this.meterNumerator === 2 && this.meterDenominator === 4 ? this.theme().chipActiveText : this.theme().textSecondary)
          .backgroundColor(this.meterNumerator === 2 && this.meterDenominator === 4 ? this.theme().chipActiveBg : this.theme().chipBg)
          .border({
            width: 1,
            color: this.meterNumerator === 2 && this.meterDenominator === 4 ? this.theme().primarySoft : this.theme().borderColor
          })
          .borderRadius(16)
          .padding({ left: 12, right: 12 })
          .height(38)
          .margin({ right: 8, bottom: 8 })
          .onClick((): void => {
            this.withVmSync((): void => {
              this.vm.setMeterPreset(2, 4);
            });
          })

        Button('3/4')
          .fontSize(14)
          .fontWeight(this.meterNumerator === 3 && this.meterDenominator === 4 ? FontWeight.Bold : FontWeight.Regular)
          .fontColor(this.meterNumerator === 3 && this.meterDenominator === 4 ? this.theme().chipActiveText : this.theme().textSecondary)
          .backgroundColor(this.meterNumerator === 3 && this.meterDenominator === 4 ? this.theme().chipActiveBg : this.theme().chipBg)
          .border({
            width: 1,
            color: this.meterNumerator === 3 && this.meterDenominator === 4 ? this.theme().primarySoft : this.theme().borderColor
          })
          .borderRadius(16)
          .padding({ left: 12, right: 12 })
          .height(38)
          .margin({ right: 8, bottom: 8 })
          .onClick((): void => {
            this.withVmSync((): void => {
              this.vm.setMeterPreset(3, 4);
            });
          })

        Button('4/4')
          .fontSize(14)
          .fontWeight(this.meterNumerator === 4 && this.meterDenominator === 4 ? FontWeight.Bold : FontWeight.Regular)
          .fontColor(this.meterNumerator === 4 && this.meterDenominator === 4 ? this.theme().chipActiveText : this.theme().textSecondary)
          .backgroundColor(this.meterNumerator === 4 && this.meterDenominator === 4 ? this.theme().chipActiveBg : this.theme().chipBg)
          .border({
            width: 1,
            color: this.meterNumerator === 4 && this.meterDenominator === 4 ? this.theme().primarySoft : this.theme().borderColor
          })
          .borderRadius(16)
          .padding({ left: 12, right: 12 })
          .height(38)
          .margin({ right: 8, bottom: 8 })
          .onClick((): void => {
            this.withVmSync((): void => {
              this.vm.setMeterPreset(4, 4);
            });
          })

        Button('6/8')
          .fontSize(14)
          .fontWeight(this.meterNumerator === 6 && this.meterDenominator === 8 ? FontWeight.Bold : FontWeight.Regular)
          .fontColor(this.meterNumerator === 6 && this.meterDenominator === 8 ? this.theme().chipActiveText : this.theme().textSecondary)
          .backgroundColor(this.meterNumerator === 6 && this.meterDenominator === 8 ? this.theme().chipActiveBg : this.theme().chipBg)
          .border({
            width: 1,
            color: this.meterNumerator === 6 && this.meterDenominator === 8 ? this.theme().primarySoft : this.theme().borderColor
          })
          .borderRadius(16)
          .padding({ left: 12, right: 12 })
          .height(38)
          .margin({ right: 8, bottom: 8 })
          .onClick((): void => {
            this.withVmSync((): void => {
              this.vm.setMeterPreset(6, 8);
            });
          })
      }
      .width('100%')

      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center }) {
        Column({ space: 10 }) {
          Text('拍数')
            .fontSize(13)
            .fontColor(this.theme().textSecondary)

          Row({ space: 10 }) {
            this.CircleStepper('-', (): void => {
              this.withVmSync((): void => {
                this.vm.setMeter(this.meterNumerator - 1, this.meterDenominator);
              });
            });

            Text(this.meterNumerator.toString())
              .fontSize(26)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme().textPrimary)
              .width(42)
              .textAlign(TextAlign.Center)

            this.CircleStepper('+', (): void => {
              this.withVmSync((): void => {
                this.vm.setMeter(this.meterNumerator + 1, this.meterDenominator);
              });
            });
          }
          .alignItems(VerticalAlign.Center)
        }
        .padding({ left: 14, right: 14, top: 14, bottom: 14 })
        .backgroundColor(this.theme().stepperPanelBg)
        .borderRadius(18)
        .margin({ bottom: 8 })

        Text('/')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme().textMuted)
          .margin({ left: 12, right: 12 })

        Column({ space: 10 }) {
          Text('音符')
            .fontSize(13)
            .fontColor(this.theme().textSecondary)

          Row({ space: 10 }) {
            this.CircleStepper('-', (): void => {
              this.withVmSync((): void => {
                this.vm.prevDenominator();
              });
            });

            Text(this.meterDenominator.toString())
              .fontSize(26)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme().textPrimary)
              .width(42)
              .textAlign(TextAlign.Center)

            this.CircleStepper('+', (): void => {
              this.withVmSync((): void => {
                this.vm.nextDenominator();
              });
            });
          }
          .alignItems(VerticalAlign.Center)
        }
        .padding({ left: 14, right: 14, top: 14, bottom: 14 })
        .backgroundColor(this.theme().stepperPanelBg)
        .borderRadius(18)
        .margin({ bottom: 8 })
      }
      .width('100%')
    }
    .width('100%')
    .padding(18)
    .backgroundColor(this.theme().surfaceBg)
    .borderRadius(24)
  }

  @Builder
  AccentCard() {
    Column({ space: 14 }) {
      this.CardTitle('重音模式', '点击拍点切换重音，当前拍会保持高亮')

      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
        ForEach(
          this.beatArray(),
          (idx: number) => {
            Column() {
              Text((idx + 1).toString())
                .fontSize(12)
                .fontWeight(FontWeight.Medium)
                .fontColor(this.beatIndexColor(idx))
                .margin({ bottom: 6 })

              Stack({ alignContent: Alignment.Center }) {
                Column()
                  .width(46)
                  .height(46)
                  .borderRadius(23)
                  .backgroundColor(this.beatBubbleColor(idx))
                  .border({
                    width: this.curBeat === idx ? 0 : 1,
                    color: this.isBeatAccented(idx) ? this.theme().primarySoft : this.theme().borderColor
                  })

                Text(this.isBeatAccented(idx) ? '开' : '关')
                  .fontSize(14)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.beatBubbleTextColor(idx))
              }
            }
            .alignItems(HorizontalAlign.Center)
            .margin({ right: 10, bottom: 12 })
            .onClick((): void => {
              this.withVmSync((): void => {
                this.vm.toggleAccent(idx);
              });
            })
          },
          (idx: number): string => `${idx}_${this.accentBitmask}_${this.curBeat}`
        )
      }
      .width('100%')
    }
    .width('100%')
    .padding(18)
    .backgroundColor(this.theme().surfaceBg)
    .borderRadius(24)
  }

  @Builder
  VoiceCard() {
    Column({ space: 16 }) {
      this.CardTitle('语音设置', '语言、播报模式与时间偏移')

      Column({ space: 10 }) {
        Text('语言')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme().textPrimary)

        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
          Button('中文')
            .fontSize(14)
            .fontWeight(this.lang === 'zh' ? FontWeight.Bold : FontWeight.Regular)
            .fontColor(this.lang === 'zh' ? this.theme().chipActiveText : this.theme().textSecondary)
            .backgroundColor(this.lang === 'zh' ? this.theme().chipActiveBg : this.theme().chipBg)
            .border({
              width: 1,
              color: this.lang === 'zh' ? this.theme().primarySoft : this.theme().borderColor
            })
            .borderRadius(16)
            .padding({ left: 12, right: 12 })
            .height(38)
            .margin({ right: 8, bottom: 8 })
            .onClick((): void => {
              this.withVmSync((): void => {
                this.vm.setLanguage('zh');
              });
            })

          Button('英语')
            .fontSize(14)
            .fontWeight(this.lang === 'en' ? FontWeight.Bold : FontWeight.Regular)
            .fontColor(this.lang === 'en' ? this.theme().chipActiveText : this.theme().textSecondary)
            .backgroundColor(this.lang === 'en' ? this.theme().chipActiveBg : this.theme().chipBg)
            .border({
              width: 1,
              color: this.lang === 'en' ? this.theme().primarySoft : this.theme().borderColor
            })
            .borderRadius(16)
            .padding({ left: 12, right: 12 })
            .height(38)
            .margin({ right: 8, bottom: 8 })
            .onClick((): void => {
              this.withVmSync((): void => {
                this.vm.setLanguage('en');
              });
            })

          Button('日语')
            .fontSize(14)
            .fontWeight(this.lang === 'ja' ? FontWeight.Bold : FontWeight.Regular)
            .fontColor(this.lang === 'ja' ? this.theme().chipActiveText : this.theme().textSecondary)
            .backgroundColor(this.lang === 'ja' ? this.theme().chipActiveBg : this.theme().chipBg)
            .border({
              width: 1,
              color: this.lang === 'ja' ? this.theme().primarySoft : this.theme().borderColor
            })
            .borderRadius(16)
            .padding({ left: 12, right: 12 })
            .height(38)
            .margin({ right: 8, bottom: 8 })
            .onClick((): void => {
              this.withVmSync((): void => {
                this.vm.setLanguage('ja');
              });
            })
        }
        .width('100%')
      }
      .width('100%')

      Column({ space: 10 }) {
        Text('播报模式')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme().textPrimary)

        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
          Button('每一拍')
            .fontSize(14)
            .fontWeight(!this.firstBeatOnly ? FontWeight.Bold : FontWeight.Regular)
            .fontColor(!this.firstBeatOnly ? this.theme().chipActiveText : this.theme().textSecondary)
            .backgroundColor(!this.firstBeatOnly ? this.theme().chipActiveBg : this.theme().chipBg)
            .border({
              width: 1,
              color: !this.firstBeatOnly ? this.theme().primarySoft : this.theme().borderColor
            })
            .borderRadius(16)
            .padding({ left: 12, right: 12 })
            .height(38)
            .margin({ right: 8, bottom: 8 })
            .onClick((): void => {
              this.withVmSync((): void => {
                this.vm.setVoiceMode('every');
              });
            })

          Button('仅首拍')
            .fontSize(14)
            .fontWeight(this.firstBeatOnly ? FontWeight.Bold : FontWeight.Regular)
            .fontColor(this.firstBeatOnly ? this.theme().chipActiveText : this.theme().textSecondary)
            .backgroundColor(this.firstBeatOnly ? this.theme().chipActiveBg : this.theme().chipBg)
            .border({
              width: 1,
              color: this.firstBeatOnly ? this.theme().primarySoft : this.theme().borderColor
            })
            .borderRadius(16)
            .padding({ left: 12, right: 12 })
            .height(38)
            .margin({ right: 8, bottom: 8 })
            .onClick((): void => {
              this.withVmSync((): void => {
                this.vm.setVoiceMode('first');
              });
            })
        }
        .width('100%')
      }
      .width('100%')

      Column({ space: 10 }) {
        Row() {
          Text('语音偏移')
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme().textPrimary)
          Blank()
          Text(`${this.voiceOffsetMs > 0 ? '+' : ''}${this.voiceOffsetMs} ms`)
            .fontSize(14)
            .fontColor(this.theme().textSecondary)
        }
        .width('100%')

        Slider({
          value: this.voiceOffsetMs,
          min: -200,
          max: 200,
          step: 10,
          style: SliderStyle.OutSet
        })
          .trackColor(this.theme().sliderTrack)
          .selectedColor(this.theme().primary)
          .blockColor(this.theme().sliderBlock)
          .onChange((value: number): void => {
            this.withVmSync((): void => {
              this.vm.setVoiceOffsetMs(value);
            });
          })

        Row() {
          Text('提前')
            .fontSize(12)
            .fontColor(this.theme().textMuted)
          Blank()
          Text('延后')
            .fontSize(12)
            .fontColor(this.theme().textMuted)
        }
        .width('100%')
      }
      .width('100%')
    }
    .width('100%')
    .padding(18)
    .backgroundColor(this.theme().surfaceBg)
    .borderRadius(24)
  }

  @Builder
  CardTitle(title: string, desc: string) {
    Column() {
      Text(title)
        .fontSize(18)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme().textPrimary)

      Text(desc)
        .fontSize(12)
        .fontColor(this.theme().textSecondary)
        .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }

  @Builder
  ActionButton(label: string, onTap: () => void) {
    Button(label)
      .fontSize(14)
      .fontColor(this.theme().textPrimary)
      .backgroundColor(this.theme().chipBg)
      .borderRadius(14)
      .width(64)
      .height(38)
      .margin({ left: 4, right: 4, top: 4, bottom: 4 })
      .onClick((): void => {
        onTap();
      })
  }

  @Builder
  CircleStepper(label: string, onTap: () => void) {
    Button(label)
      .fontSize(20)
      .fontWeight(FontWeight.Bold)
      .fontColor(this.theme().textPrimary)
      .backgroundColor(this.theme().stepperButtonBg)
      .border({
        width: 1,
        color: this.theme().borderColor
      })
      .width(38)
      .height(38)
      .borderRadius(19)
      .onClick((): void => {
        onTap();
      })
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.None, duration: 250 })
      .opacity(0)
    PageTransitionExit({ type: RouteType.None, duration: 180 })
      .opacity(0)
  }
}

