import { common } from '@kit.AbilityKit';
import { PreferencesManager } from '../data/PreferencesManager';
import { APP_NAME, APP_TAGLINE, PRIVACY_POLICY_URL } from '../common/AppInfo';
import { resolveTheme, AppThemePalette } from '../theme/AppTheme';
import { MetronomeViewModel } from '../viewmodel/MetronomeViewModel';

@Entry
@Component
struct Index {
  private vm: MetronomeViewModel = new MetronomeViewModel();
  private privacyPrefs: PreferencesManager = new PreferencesManager();
  private uiContext: common.UIAbilityContext | null = null;
  private privacyStatusLoaded: boolean = false;

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
  @State privacyAccepted: boolean = false;
  @State privacyLoading: boolean = true;
  @State privacySubmitting: boolean = false;
  @State privacyLinkOpening: boolean = false;
  @State privacyMessage: string = '';
  @State viewModelInitialized: boolean = false;

  aboutToAppear(): void {
    this.vm.setOnStateChange((): void => {
      this.syncState();
    });
    this.syncState();
    const ctx = AppStorage.get<common.UIAbilityContext>('uiAbilityContext');
    if (ctx !== undefined) {
      this.uiContext = ctx;
      if (this.privacyStatusLoaded) {
        if (this.privacyAccepted && !this.viewModelInitialized) {
          this.ensureViewModelReady().catch((_: Object): void => {});
        }
      } else {
        this.bootstrapPrivacyGate(ctx).catch((_: Object): void => {});
      }
    } else {
      this.privacyLoading = false;
      this.privacyMessage = '应用上下文尚未就绪，请重新启动后重试。';
    }
  }

  aboutToDisappear(): void {
    if (this.viewModelInitialized) {
      this.vm.destroy().catch((_: Object): void => {});
      this.viewModelInitialized = false;
    }
  }

  // 首次启动前先读取隐私同意状态，未同意时不初始化音频与后台能力。
  private async bootstrapPrivacyGate(context: common.UIAbilityContext): Promise<void> {
    this.privacyLoading = true;
    this.privacyMessage = '';
    try {
      await this.privacyPrefs.init(context);
      this.privacyAccepted = await this.privacyPrefs.hasAcceptedPrivacyPolicy();
      this.privacyStatusLoaded = true;
      if (this.privacyAccepted) {
        await this.ensureViewModelReady();
      }
    } catch (e) {
      if (this.privacyAccepted) {
        this.privacyMessage = `主界面初始化失败：${this.errorMessageOf(e)}`;
      } else {
        this.privacyMessage = `隐私状态读取失败：${this.errorMessageOf(e)}`;
      }
    } finally {
      this.privacyLoading = false;
    }
  }

  // 同意后再初始化业务 ViewModel，确保授权前应用不会进入可用态。
  private async ensureViewModelReady(): Promise<void> {
    if (this.viewModelInitialized || this.uiContext === null) {
      return;
    }
    await this.vm.init(this.uiContext);
    this.viewModelInitialized = true;
    this.privacyMessage = '';
    this.syncState();
  }

  private async openPrivacyPolicy(): Promise<void> {
    if (this.uiContext === null || this.privacyLinkOpening) {
      return;
    }
    this.privacyLinkOpening = true;
    this.privacyMessage = '';
    try {
      await this.uiContext.openLink(PRIVACY_POLICY_URL);
    } catch (_) {
      this.privacyMessage = `无法自动打开完整政策，请手动访问：${PRIVACY_POLICY_URL}`;
    } finally {
      this.privacyLinkOpening = false;
    }
  }

  private async acceptPrivacyPolicy(): Promise<void> {
    if (this.uiContext === null || this.privacySubmitting) {
      return;
    }
    this.privacySubmitting = true;
    this.privacyMessage = '';
    try {
      await this.privacyPrefs.init(this.uiContext);
      await this.privacyPrefs.setPrivacyPolicyAccepted(true);
      this.privacyAccepted = true;
      this.privacyStatusLoaded = true;
      await this.ensureViewModelReady();
    } catch (e) {
      this.privacyAccepted = false;
      this.privacyMessage = `保存隐私同意状态失败：${this.errorMessageOf(e)}`;
    } finally {
      this.privacySubmitting = false;
    }
  }

  private async declinePrivacyPolicy(): Promise<void> {
    if (this.uiContext === null || this.privacySubmitting) {
      return;
    }
    this.privacySubmitting = true;
    this.privacyMessage = '';
    try {
      await this.uiContext.terminateSelf();
    } catch (_) {
      this.privacySubmitting = false;
      this.privacyMessage = '无法自动退出应用，请手动关闭后再决定是否同意。';
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
    Stack({ alignContent: Alignment.Center }) {
      if (this.privacyAccepted && this.viewModelInitialized) {
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
        this.LockedShell();
      }

      if (!this.privacyAccepted) {
        this.PrivacyPolicyOverlay();
      } else if (!this.viewModelInitialized) {
        this.InitializingOverlay();
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme().pageBg)
  }

  @Builder
  LockedShell() {
    Column({ space: 14 }) {
      Text(APP_NAME)
        .fontSize(30)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme().textPrimary)

      Text(`首次启动前需要完成${APP_NAME}隐私政策确认。`)
        .fontSize(15)
        .fontColor(this.theme().textSecondary)

      if (this.privacyAccepted && !this.viewModelInitialized) {
        LoadingProgress()
          .width(36)
          .height(36)
          .margin({ top: 12 })

        Text(`正在初始化${APP_NAME}...`)
          .fontSize(13)
          .fontColor(this.theme().textMuted)
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(24)
    .backgroundColor(this.theme().pageBg)
  }

  @Builder
  InitializingOverlay() {
    Column({ space: 14 }) {
      LoadingProgress()
        .width(42)
        .height(42)

      Text(`正在完成授权后的初始化，请稍候。`)
        .fontSize(14)
        .fontColor(this.theme().textPrimary)
    }
    .padding({ left: 28, right: 28, top: 24, bottom: 24 })
    .backgroundColor(this.theme().dialogBg)
    .borderRadius(24)
  }

  @Builder
  PrivacyPolicyOverlay() {
    Column() {
      Column({ space: 16 }) {
        Text(`${APP_NAME}用户隐私政策`)
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme().textPrimary)
          .width('100%')

        Text(`为保障你在使用${APP_NAME}过程中的个人信息与合法权益，首次启动需要先阅读并同意隐私政策；未同意前，应用不会进入可使用状态。`)
          .fontSize(14)
          .lineHeight(22)
          .fontColor(this.theme().textSecondary)
          .width('100%')

        Text('首次启动必读')
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme().policyTagText)
          .padding({ left: 10, right: 10, top: 6, bottom: 6 })
          .backgroundColor(this.theme().policyTagBg)
          .borderRadius(14)

        if (this.privacyLoading) {
          Column({ space: 12 }) {
            LoadingProgress()
              .width(34)
              .height(34)

            Text('正在检查隐私授权状态...')
              .fontSize(14)
              .fontColor(this.theme().textSecondary)
          }
          .width('100%')
          .padding({ top: 12, bottom: 12 })
        } else {
          Scroll() {
            Column({ space: 12 }) {
              this.PolicyBullet(`${APP_NAME}会在本地保存节拍器参数，例如 BPM、拍号、重音和语音设置。`)
              this.PolicyBullet(`音频播放与后台运行能力仅用于维持${APP_NAME}播放，不会在未同意前初始化。`)
              this.PolicyBullet('完整政策以华为云托管页面为准，点击下方按钮可查看原文。')
            }
            .width('100%')
          }
          .width('100%')
          .height(144)

          Button(this.privacyLinkOpening ? '正在打开完整政策...' : '查看完整隐私政策')
            .fontSize(15)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme().primary)
            .backgroundColor(this.theme().surfaceSubtle)
            .border({
              width: 1,
              color: this.theme().primarySoft
            })
            .borderRadius(16)
            .width('100%')
            .height(48)
            .onClick((): void => {
              this.openPrivacyPolicy().catch((_: Object): void => {});
            })

          if (this.privacyMessage.length > 0) {
            Text(this.privacyMessage)
              .fontSize(12)
              .lineHeight(18)
              .fontColor(this.theme().danger)
              .width('100%')
          }

          Row({ space: 12 }) {
            Button(this.privacySubmitting ? '处理中...' : '不同意并退出')
              .fontSize(15)
              .fontColor(this.theme().textPrimary)
              .backgroundColor(this.theme().chipBg)
              .borderRadius(16)
              .width('48%')
              .height(52)
              .onClick((): void => {
                this.declinePrivacyPolicy().catch((_: Object): void => {});
              })

            Button(this.privacySubmitting ? '处理中...' : '同意并继续')
              .fontSize(15)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme().chipActiveText)
              .backgroundColor(this.theme().primary)
              .borderRadius(16)
              .width('48%')
              .height(52)
              .onClick((): void => {
                this.acceptPrivacyPolicy().catch((_: Object): void => {});
              })
          }
          .width('100%')
        }
      }
      .width('100%')
      .padding(22)
      .backgroundColor(this.theme().dialogBg)
      .borderRadius(28)
    }
    .width('100%')
    .height('100%')
    .padding(18)
    .backgroundColor(this.theme().overlayBg)
    .justifyContent(FlexAlign.Center)
  }

  @Builder
  PolicyBullet(content: string) {
    Row() {
      Text('•')
        .fontSize(16)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme().primary)
        .margin({ top: 2, right: 8 })

      Text(content)
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.theme().textPrimary)
        .layoutWeight(1)
    }
    .width('100%')
    .alignItems(VerticalAlign.Top)
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
    Column({ space: 16 }) {
      this.CardTitle('拍号', '常用拍号与自定义拍值')

      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
        this.SelectChip('2/4', this.meterNumerator === 2 && this.meterDenominator === 4, (): void => {
          this.withVmSync((): void => {
            this.vm.setMeterPreset(2, 4);
          });
        });
        this.SelectChip('3/4', this.meterNumerator === 3 && this.meterDenominator === 4, (): void => {
          this.withVmSync((): void => {
            this.vm.setMeterPreset(3, 4);
          });
        });
        this.SelectChip('4/4', this.meterNumerator === 4 && this.meterDenominator === 4, (): void => {
          this.withVmSync((): void => {
            this.vm.setMeterPreset(4, 4);
          });
        });
        this.SelectChip('6/8', this.meterNumerator === 6 && this.meterDenominator === 8, (): void => {
          this.withVmSync((): void => {
            this.vm.setMeterPreset(6, 8);
          });
        });
      }
      .width('100%')

      Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center }) {
        this.StepperPanel('拍数', this.meterNumerator.toString(), (): void => {
          this.withVmSync((): void => {
            this.vm.setMeter(this.meterNumerator - 1, this.meterDenominator);
          });
        }, (): void => {
          this.withVmSync((): void => {
            this.vm.setMeter(this.meterNumerator + 1, this.meterDenominator);
          });
        })

        Text('/')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme().textMuted)
          .margin({ left: 12, right: 12 })

        this.StepperPanel('音符', this.meterDenominator.toString(), (): void => {
          this.withVmSync((): void => {
            this.vm.prevDenominator();
          });
        }, (): void => {
          this.withVmSync((): void => {
            this.vm.nextDenominator();
          });
        })
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
          this.SelectChip('中文', this.lang === 'zh', (): void => {
            this.withVmSync((): void => {
              this.vm.setLanguage('zh');
            });
          });
          this.SelectChip('英语', this.lang === 'en', (): void => {
            this.withVmSync((): void => {
              this.vm.setLanguage('en');
            });
          });
          this.SelectChip('日语', this.lang === 'ja', (): void => {
            this.withVmSync((): void => {
              this.vm.setLanguage('ja');
            });
          });
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
          this.SelectChip('每一拍', !this.firstBeatOnly, (): void => {
            this.withVmSync((): void => {
              this.vm.setVoiceMode('every');
            });
          });
          this.SelectChip('仅首拍', this.firstBeatOnly, (): void => {
            this.withVmSync((): void => {
              this.vm.setVoiceMode('first');
            });
          });
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
  SelectChip(label: string, selected: boolean, onTap: () => void) {
    Button(label)
      .fontSize(14)
      .fontWeight(selected ? FontWeight.Bold : FontWeight.Regular)
      .fontColor(selected ? this.theme().chipActiveText : this.theme().textSecondary)
      .backgroundColor(selected ? this.theme().chipActiveBg : this.theme().chipBg)
      .border({
        width: 1,
        color: selected ? this.theme().primarySoft : this.theme().borderColor
      })
      .borderRadius(16)
      .padding({ left: 12, right: 12 })
      .height(38)
      .margin({ right: 8, bottom: 8 })
      .onClick((): void => {
        onTap();
      })
  }

  @Builder
  StepperPanel(title: string, value: string, onDecrease: () => void, onIncrease: () => void) {
    Column({ space: 10 }) {
      Text(title)
        .fontSize(13)
        .fontColor(this.theme().textSecondary)

      Row({ space: 10 }) {
        this.CircleStepper('-', onDecrease);

        Text(value)
          .fontSize(26)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme().textPrimary)
          .width(42)
          .textAlign(TextAlign.Center)

        this.CircleStepper('+', onIncrease);
      }
      .alignItems(VerticalAlign.Center)
    }
    .padding({ left: 14, right: 14, top: 14, bottom: 14 })
    .backgroundColor(this.theme().stepperPanelBg)
    .borderRadius(18)
    .margin({ bottom: 8 })
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
