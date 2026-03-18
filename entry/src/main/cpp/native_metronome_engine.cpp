#include "native_metronome_engine.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace {
constexpr double CLICK_DURATION_SEC = 0.03;
constexpr double ACCENT_FREQ_HZ = 1000.0;
constexpr double NORMAL_FREQ_HZ = 800.0;
constexpr float ACCENT_AMPLITUDE = 0.8f;
constexpr float NORMAL_AMPLITUDE = 0.5f;
constexpr double DECAY_TARGET = 6.907755278982137; // ln(1000)
constexpr double TWO_PI = 6.283185307179586;
constexpr std::array<const char*, 3> LANGUAGE_CODES = {"zh", "en", "ja"};
}

int NativeMetronomeEngine::init(int sampleRate) {
    if (sampleRate <= 0) {
        return -1;
    }

    sampleRate_ = sampleRate;
    initialized_ = true;
    reset();
    prepare();
    return 0;
}

void NativeMetronomeEngine::release() {
    for (auto& languageSamples : voiceSamples_) {
        for (auto& beatSamples : languageSamples) {
            beatSamples.clear();
        }
    }
    voiceTriggers_.clear();
    pendingVoiceTriggers_.clear();
    accentClick_.clear();
    normalClick_.clear();
    activeClickSource_ = nullptr;
    activeVoiceSample_ = nullptr;
    initialized_ = false;
}

int NativeMetronomeEngine::setVoiceSample(const std::string& language, int beatNumber,
                                          const uint8_t* sampleBytes, size_t sampleCount) {
    const int languageIndex = languageToIndex(language);
    if (languageIndex < 0 || beatNumber < 1 || beatNumber > kBeatCount || sampleBytes == nullptr || sampleCount == 0) {
        return -1;
    }

    auto& target = voiceSamples_[languageIndex][static_cast<size_t>(beatNumber - 1)];
    target.resize(sampleCount);
    std::memcpy(target.data(), sampleBytes, sampleCount * sizeof(float));
    return 0;
}

int NativeMetronomeEngine::updateParams(const NativeEngineParams& params) {
    params_.bpm = clampBpm(params.bpm);
    params_.meterNumerator = clampMeterNumerator(params.meterNumerator);
    params_.meterDenominator = clampMeterDenominator(params.meterDenominator);
    params_.accentBitmask = params.accentBitmask;
    params_.language = languageToIndex(params.language) >= 0 ? params.language : "zh";
    params_.firstBeatOnly = params.firstBeatOnly;
    params_.voiceOffsetMs = clampVoiceOffset(params.voiceOffsetMs);
    return 0;
}

void NativeMetronomeEngine::prepare() {
    generateClickWaveforms();
    framesPerBeat_ = calcFramesPerBeat(params_.bpm, params_.meterDenominator);
    lastBpm_ = params_.bpm;
    lastMeterNumerator_ = params_.meterNumerator;
    lastMeterDenominator_ = params_.meterDenominator;
}

void NativeMetronomeEngine::reset() {
    totalFramesRendered_ = 0;
    nextBeatFrame_ = 0;
    framesPerBeat_ = calcFramesPerBeat(params_.bpm, params_.meterDenominator);
    currentBeatInMeasure_ = 0;
    activeClickSource_ = nullptr;
    clickPlaybackPos_ = 0;
    activeVoiceSample_ = nullptr;
    voicePlaybackPos_ = 0;
    pendingVoiceTriggers_.clear();
    voiceTriggers_.clear();
    lastBpm_ = 0;
    lastMeterNumerator_ = 0;
    lastMeterDenominator_ = 0;
}

int NativeMetronomeEngine::renderAudio(float* buffer, int numFrames) {
    if (buffer == nullptr || numFrames <= 0) {
        return -1;
    }

    std::memset(buffer, 0, static_cast<size_t>(numFrames) * sizeof(float));
    if (!initialized_) {
        return -1;
    }

    handleParamChanges();
    collectVoiceTriggers(numFrames);

    size_t triggerIndex = 0;
    int latestBeatIndex = -1;

    for (int frame = 0; frame < numFrames; frame++) {
        const int64_t globalFrame = totalFramesRendered_ + frame;

        if (globalFrame >= nextBeatFrame_) {
            const int beatIndex = currentBeatInMeasure_;
            const bool isAccent = ((params_.accentBitmask >> beatIndex) & 0x1U) == 1U;
            activeClickSource_ = isAccent ? &accentClick_ : &normalClick_;
            clickPlaybackPos_ = 0;
            latestBeatIndex = beatIndex;

            currentBeatInMeasure_ = (beatIndex + 1) % params_.meterNumerator;
            nextBeatFrame_ += framesPerBeat_;
        }

        float sampleValue = 0.0f;

        if (activeClickSource_ != nullptr && clickPlaybackPos_ < activeClickSource_->size()) {
            sampleValue += (*activeClickSource_)[clickPlaybackPos_];
            clickPlaybackPos_++;
            if (clickPlaybackPos_ >= activeClickSource_->size()) {
                activeClickSource_ = nullptr;
                clickPlaybackPos_ = 0;
            }
        }

        while (triggerIndex < voiceTriggers_.size() && voiceTriggers_[triggerIndex].localFrame == frame) {
            activeVoiceSample_ = voiceTriggers_[triggerIndex].sample;
            voicePlaybackPos_ = 0;
            triggerIndex++;
        }

        if (activeVoiceSample_ != nullptr && voicePlaybackPos_ < activeVoiceSample_->size()) {
            sampleValue += (*activeVoiceSample_)[voicePlaybackPos_];
            voicePlaybackPos_++;
            if (voicePlaybackPos_ >= activeVoiceSample_->size()) {
                activeVoiceSample_ = nullptr;
                voicePlaybackPos_ = 0;
            }
        }

        buffer[frame] = std::clamp(sampleValue, -1.0f, 1.0f);
    }

    totalFramesRendered_ += numFrames;
    return latestBeatIndex;
}

int NativeMetronomeEngine::clampBpm(int bpm) const {
    return std::clamp(bpm, 30, 300);
}

int NativeMetronomeEngine::clampMeterNumerator(int numerator) const {
    return std::clamp(numerator, 1, 12);
}

int NativeMetronomeEngine::clampMeterDenominator(int denominator) const {
    switch (denominator) {
        case 1:
        case 2:
        case 4:
        case 8:
        case 16:
            return denominator;
        default:
            return 4;
    }
}

int NativeMetronomeEngine::clampVoiceOffset(int offsetMs) const {
    return std::clamp(offsetMs, -200, 200);
}

int NativeMetronomeEngine::languageToIndex(const std::string& language) const {
    for (size_t index = 0; index < LANGUAGE_CODES.size(); index++) {
        if (language == LANGUAGE_CODES[index]) {
            return static_cast<int>(index);
        }
    }
    return -1;
}

const std::vector<float>* NativeMetronomeEngine::resolveVoiceSample(const std::string& language, int beatNumber) const {
    if (beatNumber < 1 || beatNumber > kBeatCount) {
        return nullptr;
    }

    const int requestedIndex = languageToIndex(language);
    const size_t beatIndex = static_cast<size_t>(beatNumber - 1);
    const std::array<int, 3> fallbackOrder = {
        requestedIndex >= 0 ? requestedIndex : 0,
        0,
        1
    };

    for (int languageIndex : fallbackOrder) {
        if (languageIndex < 0 || languageIndex >= kLanguageCount) {
            continue;
        }
        const auto& sample = voiceSamples_[static_cast<size_t>(languageIndex)][beatIndex];
        if (!sample.empty()) {
            return &sample;
        }
    }

    return nullptr;
}

int64_t NativeMetronomeEngine::calcFramesPerBeat(int bpm, int meterDenominator) const {
    const double beatUnit = 4.0 / static_cast<double>(clampMeterDenominator(meterDenominator));
    const double frames = static_cast<double>(sampleRate_) * 60.0 / static_cast<double>(clampBpm(bpm)) * beatUnit;
    return std::max<int64_t>(1, static_cast<int64_t>(std::llround(frames)));
}

void NativeMetronomeEngine::handleParamChanges() {
    if (params_.bpm != lastBpm_ || params_.meterDenominator != lastMeterDenominator_) {
        framesPerBeat_ = calcFramesPerBeat(params_.bpm, params_.meterDenominator);
        nextBeatFrame_ = totalFramesRendered_ + framesPerBeat_;
        lastBpm_ = params_.bpm;
        lastMeterDenominator_ = params_.meterDenominator;
        generateClickWaveforms();
    }

    if (params_.meterNumerator != lastMeterNumerator_) {
        currentBeatInMeasure_ = currentBeatInMeasure_ % params_.meterNumerator;
        lastMeterNumerator_ = params_.meterNumerator;
    }
}

void NativeMetronomeEngine::generateClickWaveforms() {
    const int clickSamples = std::max(1, static_cast<int>(std::floor(sampleRate_ * CLICK_DURATION_SEC)));
    const double decayRate = DECAY_TARGET / static_cast<double>(clickSamples);

    accentClick_.resize(static_cast<size_t>(clickSamples));
    normalClick_.resize(static_cast<size_t>(clickSamples));

    const double accentPhase = TWO_PI * ACCENT_FREQ_HZ / static_cast<double>(sampleRate_);
    const double normalPhase = TWO_PI * NORMAL_FREQ_HZ / static_cast<double>(sampleRate_);

    for (int index = 0; index < clickSamples; index++) {
        const double envelope = std::exp(-decayRate * static_cast<double>(index));
        accentClick_[static_cast<size_t>(index)] = static_cast<float>(ACCENT_AMPLITUDE * envelope * std::sin(accentPhase * index));
        normalClick_[static_cast<size_t>(index)] = static_cast<float>(NORMAL_AMPLITUDE * envelope * std::sin(normalPhase * index));
    }
}

void NativeMetronomeEngine::collectVoiceTriggers(int numFrames) {
    voiceTriggers_.clear();

    bool hasAnyVoiceSample = false;
    for (const auto& languageSamples : voiceSamples_) {
        for (const auto& beatSamples : languageSamples) {
            if (!beatSamples.empty()) {
                hasAnyVoiceSample = true;
                break;
            }
        }
        if (hasAnyVoiceSample) {
            break;
        }
    }
    if (!hasAnyVoiceSample) {
        pendingVoiceTriggers_.clear();
        return;
    }

    collectPendingVoiceTriggers(numFrames);

    const int offsetFrames = static_cast<int>(std::llround(static_cast<double>(params_.voiceOffsetMs) * sampleRate_ / 1000.0));
    const int lookaheadFrames = offsetFrames < 0 ? std::max(-offsetFrames, sampleRate_ / 5) : 0;
    const int64_t scanStart = totalFramesRendered_;
    const int64_t scanEnd = totalFramesRendered_ + numFrames + lookaheadFrames;

    int64_t beatFrame = nextBeatFrame_;
    int beatInMeasure = currentBeatInMeasure_;

    if (beatFrame < scanStart && framesPerBeat_ > 0) {
        const int64_t missingFrames = scanStart - beatFrame;
        const int64_t steps = (missingFrames + framesPerBeat_ - 1) / framesPerBeat_;
        beatFrame += steps * framesPerBeat_;
        beatInMeasure = static_cast<int>((beatInMeasure + steps) % params_.meterNumerator);
    }

    while (beatFrame < scanEnd && framesPerBeat_ > 0) {
        const bool shouldPlayVoice = !params_.firstBeatOnly || beatInMeasure == 0;
        if (shouldPlayVoice) {
            const std::vector<float>* voiceSample = resolveVoiceSample(params_.language, beatInMeasure + 1);
            if (voiceSample != nullptr) {
                const int64_t voiceStartFrame = beatFrame + offsetFrames;
                const int64_t localFrame = voiceStartFrame - totalFramesRendered_;
                if (localFrame >= 0 && localFrame < numFrames) {
                    addImmediateVoiceTrigger(static_cast<int>(localFrame), voiceSample);
                } else if (offsetFrames > 0 && localFrame >= numFrames) {
                    queuePendingVoiceTrigger(voiceStartFrame, voiceSample);
                }
            }
        }

        beatFrame += framesPerBeat_;
        beatInMeasure = (beatInMeasure + 1) % params_.meterNumerator;
    }

    sortVoiceTriggers();
}

void NativeMetronomeEngine::collectPendingVoiceTriggers(int numFrames) {
    if (pendingVoiceTriggers_.empty()) {
        return;
    }

    const int64_t bufferEnd = totalFramesRendered_ + numFrames;
    std::vector<PendingVoiceTrigger> futureTriggers;
    futureTriggers.reserve(pendingVoiceTriggers_.size());

    for (const PendingVoiceTrigger& trigger : pendingVoiceTriggers_) {
        if (trigger.sample == nullptr) {
            continue;
        }

        if (trigger.globalFrame < bufferEnd) {
            const int localFrame = static_cast<int>(std::max<int64_t>(0, trigger.globalFrame - totalFramesRendered_));
            addImmediateVoiceTrigger(localFrame, trigger.sample);
            continue;
        }

        futureTriggers.push_back(trigger);
    }

    pendingVoiceTriggers_.swap(futureTriggers);
}

void NativeMetronomeEngine::addImmediateVoiceTrigger(int localFrame, const std::vector<float>* sample) {
    if (sample == nullptr) {
        return;
    }
    voiceTriggers_.push_back({localFrame, sample});
}

void NativeMetronomeEngine::queuePendingVoiceTrigger(int64_t globalFrame, const std::vector<float>* sample) {
    if (sample == nullptr) {
        return;
    }
    pendingVoiceTriggers_.push_back({globalFrame, sample});
}

void NativeMetronomeEngine::sortVoiceTriggers() {
    std::sort(voiceTriggers_.begin(), voiceTriggers_.end(),
              [](const VoiceTrigger& left, const VoiceTrigger& right) {
                  return left.localFrame < right.localFrame;
              });
}
