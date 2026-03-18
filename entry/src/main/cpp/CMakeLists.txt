cmake_minimum_required(VERSION 3.5.0)
project(metronome_native)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(metronome_native SHARED
    napi_init.cpp
    native_metronome_engine.cpp
)

target_include_directories(metronome_native PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(metronome_native PUBLIC
    libace_napi.z.so
    libhilog_ndk.z.so
)
