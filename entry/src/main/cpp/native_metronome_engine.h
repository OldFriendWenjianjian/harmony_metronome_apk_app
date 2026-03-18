#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <vector>

struct NativeEngineParams {
    int bpm = 120;
    int meterNumerator = 4;
    int meterDenominator = 4;
    uint32_t accentBitmask = 0x1;
    std::string language = "zh";
    bool firstBeatOnly = true;
    int voiceOffsetMs = 0;
};

class NativeMetronomeEngine {
public:
    int init(int sampleRate);
    void release();

    int setVoiceSample(const std::string& language, int beatNumber,
                       const uint8_t* sampleBytes, size_t sampleCount);
    int updateParams(const NativeEngineParams& params);

    void prepare();
    void reset();

    // 返回本次 buffer 内最后一次触发的拍点，若没有触发则返回 -1。
    int renderAudio(float* buffer, int numFrames);

private:
    struct VoiceTrigger {
        int localFrame = 0;
        const std::vector<float>* sample = nullptr;
    };

    struct PendingVoiceTrigger {
        int64_t globalFrame = 0;
        const std::vector<float>* sample = nullptr;
    };

    static constexpr int kLanguageCount = 3;
    static constexpr int kBeatCount = 12;

    int clampBpm(int bpm) const;
    int clampMeterNumerator(int numerator) const;
    int clampMeterDenominator(int denominator) const;
    int clampVoiceOffset(int offsetMs) const;
    int languageToIndex(const std::string& language) const;
    const std::vector<float>* resolveVoiceSample(const std::string& language, int beatNumber) const;
    int64_t calcFramesPerBeat(int bpm, int meterDenominator) const;
    void handleParamChanges();
    void generateClickWaveforms();
    void collectVoiceTriggers(int numFrames);
    void collectPendingVoiceTriggers(int numFrames);
    void addImmediateVoiceTrigger(int localFrame, const std::vector<float>* sample);
    void queuePendingVoiceTrigger(int64_t globalFrame, const std::vector<float>* sample);
    void sortVoiceTriggers();

    int sampleRate_ = 48000;
    bool initialized_ = false;

    NativeEngineParams params_;
    int lastBpm_ = 0;
    int lastMeterNumerator_ = 0;
    int lastMeterDenominator_ = 0;

    std::vector<float> accentClick_;
    std::vector<float> normalClick_;

    int64_t totalFramesRendered_ = 0;
    int64_t nextBeatFrame_ = 0;
    int64_t framesPerBeat_ = 0;
    int currentBeatInMeasure_ = 0;

    const std::vector<float>* activeClickSource_ = nullptr;
    size_t clickPlaybackPos_ = 0;
    const std::vector<float>* activeVoiceSample_ = nullptr;
    size_t voicePlaybackPos_ = 0;

    std::array<std::array<std::vector<float>, kBeatCount>, kLanguageCount> voiceSamples_{};
    std::vector<VoiceTrigger> voiceTriggers_{};
    std::vector<PendingVoiceTrigger> pendingVoiceTriggers_{};
};
