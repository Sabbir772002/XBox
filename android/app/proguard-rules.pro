# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native specific rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }

# Keep React Native bridge
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Keep your app's main components
-keep class com.myapp.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enum values and methods
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep annotations
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes Signature

# Keep generic signatures
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault

# Keep source file names for debugging
-keepattributes SourceFile,LineNumberTable

# Keep React Native modules
-keep @com.facebook.react.uimanager.annotations.ReactProp class *
-keep @com.facebook.react.uimanager.annotations.ReactPropGroup class *

# Keep Firebase classes (if using Firebase)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep SQLite classes
-keep class org.sqlite.** { *; }
-keep class com.almworks.sqlite4java.** { *; }
