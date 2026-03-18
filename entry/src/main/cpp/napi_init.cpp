#include <napi/native_api.h>
#include <hilog/log.h>

#include <string>
#include <vector>

#include "native_metronome_engine.h"

#undef LOG_TAG
#define LOG_TAG "MetronomeNative"

namespace {
NativeMetronomeEngine g_engine;

napi_value MakeInt32(napi_env env, int32_t value) {
    napi_value result = nullptr;
    napi_create_int32(env, value, &result);
    return result;
}

napi_value MakeUndefined(napi_env env) {
    napi_value result = nullptr;
    napi_get_undefined(env, &result);
    return result;
}

std::string ReadUtf8(napi_env env, napi_value value) {
    size_t length = 0;
    napi_get_value_string_utf8(env, value, nullptr, 0, &length);
    std::vector<char> buffer(length + 1, '\0');
    napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &length);
    return std::string(buffer.data(), length);
}

bool ReadInt32(napi_env env, napi_value value, int32_t& output) {
    return napi_get_value_int32(env, value, &output) == napi_ok;
}

bool ReadBool(napi_env env, napi_value value, bool& output) {
    return napi_get_value_bool(env, value, &output) == napi_ok;
}

bool ReadArrayBuffer(napi_env env, napi_value value, uint8_t*& data, size_t& length) {
    bool isArrayBuffer = false;
    if (napi_is_arraybuffer(env, value, &isArrayBuffer) != napi_ok || !isArrayBuffer) {
        return false;
    }

    void* rawData = nullptr;
    if (napi_get_arraybuffer_info(env, value, &rawData, &length) != napi_ok || rawData == nullptr) {
        return false;
    }

    data = static_cast<uint8_t*>(rawData);
    return true;
}

napi_value InitEngine(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    int32_t sampleRate = 48000;
    if (argc < 1 || !ReadInt32(env, args[0], sampleRate)) {
        return MakeInt32(env, -1);
    }

    return MakeInt32(env, g_engine.init(sampleRate));
}

napi_value SetVoiceSample(napi_env env, napi_callback_info info) {
    size_t argc = 5;
    napi_value args[5] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    if (argc < 5) {
        return MakeInt32(env, -1);
    }

    const std::string language = ReadUtf8(env, args[0]);
    int32_t beatNumber = 1;
    if (!ReadInt32(env, args[1], beatNumber)) {
        return MakeInt32(env, -2);
    }

    uint8_t* sampleBytes = nullptr;
    size_t bufferByteLength = 0;
    if (!ReadArrayBuffer(env, args[2], sampleBytes, bufferByteLength)) {
        return MakeInt32(env, -3);
    }

    int32_t byteOffset = 0;
    int32_t sampleCount = 0;
    if (!ReadInt32(env, args[3], byteOffset) || !ReadInt32(env, args[4], sampleCount)) {
        return MakeInt32(env, -4);
    }

    if (byteOffset < 0 || sampleCount <= 0) {
        return MakeInt32(env, -5);
    }

    const size_t safeOffset = static_cast<size_t>(byteOffset);
    const size_t requiredBytes = static_cast<size_t>(sampleCount) * sizeof(float);
    if (safeOffset > bufferByteLength || requiredBytes > bufferByteLength - safeOffset) {
        return MakeInt32(env, -6);
    }

    return MakeInt32(env, g_engine.setVoiceSample(
        language,
        beatNumber,
        sampleBytes + safeOffset,
        static_cast<size_t>(sampleCount)));
}

napi_value UpdateParams(napi_env env, napi_callback_info info) {
    size_t argc = 7;
    napi_value args[7] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    if (argc < 7) {
        return MakeInt32(env, -1);
    }

    NativeEngineParams params;
    if (!ReadInt32(env, args[0], params.bpm) ||
        !ReadInt32(env, args[1], params.meterNumerator) ||
        !ReadInt32(env, args[2], params.meterDenominator)) {
        return MakeInt32(env, -2);
    }

    int32_t accentBitmask = 0x1;
    if (!ReadInt32(env, args[3], accentBitmask)) {
        return MakeInt32(env, -3);
    }
    params.accentBitmask = static_cast<uint32_t>(accentBitmask);
    params.language = ReadUtf8(env, args[4]);

    if (!ReadBool(env, args[5], params.firstBeatOnly) ||
        !ReadInt32(env, args[6], params.voiceOffsetMs)) {
        return MakeInt32(env, -4);
    }

    return MakeInt32(env, g_engine.updateParams(params));
}

napi_value Prepare(napi_env env, napi_callback_info info) {
    g_engine.prepare();
    return MakeUndefined(env);
}

napi_value Reset(napi_env env, napi_callback_info info) {
    g_engine.reset();
    return MakeUndefined(env);
}

napi_value RenderAudio(napi_env env, napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    if (argc < 3) {
        return MakeInt32(env, -1);
    }

    uint8_t* bufferBytes = nullptr;
    size_t bufferByteLength = 0;
    if (!ReadArrayBuffer(env, args[0], bufferBytes, bufferByteLength)) {
        return MakeInt32(env, -2);
    }

    int32_t byteOffset = 0;
    int32_t frameCount = 0;
    if (!ReadInt32(env, args[1], byteOffset) || !ReadInt32(env, args[2], frameCount)) {
        return MakeInt32(env, -3);
    }

    if (byteOffset < 0 || frameCount <= 0) {
        return MakeInt32(env, -4);
    }

    const size_t safeOffset = static_cast<size_t>(byteOffset);
    const size_t requiredBytes = static_cast<size_t>(frameCount) * sizeof(float);
    if (safeOffset > bufferByteLength || requiredBytes > bufferByteLength - safeOffset) {
        return MakeInt32(env, -5);
    }

    if (safeOffset % alignof(float) != 0) {
        return MakeInt32(env, -6);
    }

    float* sampleData = reinterpret_cast<float*>(bufferBytes + safeOffset);
    return MakeInt32(env, g_engine.renderAudio(sampleData, frameCount));
}

napi_value Release(napi_env env, napi_callback_info info) {
    g_engine.release();
    return MakeUndefined(env);
}
}

EXTERN_C_START
static napi_value RegisterModule(napi_env env, napi_value exports) {
    napi_property_descriptor descriptors[] = {
        {"init", nullptr, InitEngine, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"setVoiceSampleBuffer", nullptr, SetVoiceSample, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"updateParams", nullptr, UpdateParams, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"prepare", nullptr, Prepare, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"reset", nullptr, Reset, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"renderAudioBuffer", nullptr, RenderAudio, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"release", nullptr, Release, nullptr, nullptr, nullptr, napi_default, nullptr},
    };
    napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);
    return exports;
}
EXTERN_C_END

static napi_module g_module = {
    1,
    0,
    nullptr,
    RegisterModule,
    "metronome_native",
    nullptr,
    {0},
};

extern "C" __attribute__((constructor)) void RegisterMetronomeNative(void) {
    napi_module_register(&g_module);
}
