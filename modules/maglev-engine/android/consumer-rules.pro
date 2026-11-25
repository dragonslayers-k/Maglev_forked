# ProGuard / R8 rules for Maglev Engine
# JNI: Rust looks these classes and methods up by name.
-keep class com.maglev.engine.NativeCore { *; }
-keepclassmembers class * {
    native <methods>;
}
-keep class com.maglev.engine.MaglevEngineModule { *; }
-keep class com.maglev.engine.service.MaglevTorrentService { *; }
-keep class com.maglev.engine.storage.MaglevFileProvider { *; }

# yt-dlp Android wrapper and mapper models are used by its runtime/reflection paths.
# Preserve names, constructors, fields, and generic signatures for release builds.
-keep class com.yausername.youtubedl_android.** { *; }
-keep class com.yausername.youtubedl_android.mapper.** { *; }
-keepattributes Signature,RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
