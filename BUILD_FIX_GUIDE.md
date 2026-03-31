# XBox Build APK Crash Fix Guide

## Issues Fixed

### 1. **Gradle Out of Memory Error** ✅
**Problem**: The Java build process was running out of memory with only 2GB allocation.
- Error: `Native memory allocation (mmap) failed to map 459276288 bytes`
- Cause: Large dependency tree and heavy asset loading

**Solution**:
- Increased JVM heap from `-Xmx2048m` to `-Xmx6144m` (6GB)
- Increased MetaSpace from `512m` to `1024m`
- Added parallel build execution: `org.gradle.parallel=true` with 8 workers
- Added build caching: `org.gradle.caching=true`

### 2. **Missing App Initialization Error Handling** ✅
**Problem**: App crashes silently if data loading fails with no error feedback.

**Solution**:
- Added DatabaseService initialization in App.tsx
- Added error screen component to display initialization errors
- Added loading screen while data is being loaded
- Proper error messages for debugging

### 3. **Poor JSON Data Error Handling** ✅
**Problem**: JSON asset loading could fail silently without proper error messages.

**Solution**:
- Added comprehensive error logging in DataMigrationService
- Added data validation checks for JSON structure
- Added fallback values for missing fields
- Added try-catch for individual items to prevent one bad entry from breaking everything

### 4. **Android Build Optimization** ✅
**Problem**: APK size and build time were not optimized.

**Solution**:
- Added Java source/target compatibility (17)
- Enabled resource shrinking for smaller APK
- Added packaging options to avoid duplicate native libraries
- Proper ProGuard configuration
- Better lint options

## Build Steps

### Method 1: React Native CLI (Recommended)

```bash
cd d:\DEV\Django\EE\XBox_Build

# Install dependencies if not already done
npm install

# Clean build (recommended first time)
cd android
./gradlew clean

# Build APK
cd ..
npx react-native run-android --variant=release

# Or build without running on device
cd android
./gradlew assembleRelease -x bundleReleaseJsAndAssets
```

### Method 2: Direct Gradle

```bash
cd d:\DEV\Django\EE\XBox_Build\android

# Clean build
./gradlew clean

# Build debug APK
./gradlew assembleDebug

# Build release APK (requires signing config)
./gradlew assembleRelease
```

### Method 3: Android Studio

1. Open `d:\DEV\Django\EE\XBox_Build\android` in Android Studio
2. Go to **Build** → **Clean Project**
3. Go to **Build** → **Build Bundle(s)/APK(s)** → **Build APK(s)**
4. APK will be saved to: `android/app/build/outputs/apk/`

## Generated APK Location

- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`

## Testing the APK

### On Device:
```bash
# Install and run debug version
npx react-native run-android

# Install APK manually
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.busroute.mad/.MainActivity
```

### Viewing Logs:
```bash
# Real-time logs
adb logcat | grep "BusRoute\|XBox\|Error\|MainActivity"

# Save logs to file
adb logcat > build_logs.txt
```

## Version Information

- React Native: 0.81.0
- Target SDK: 36
- Min SDK: 24
- Kotlin: 2.1.0
- Gradle: 8.7.3

## Configuration Files Modified

1. `android/gradle.properties` - JVM heap and build optimization
2. `src/App.tsx` - Added initialization with error handling
3. `src/services/DataMigrationService.ts` - Improved error handling
4. `android/app/build.gradle` - Build optimization and packaging

## Troubleshooting

### If Build Still Fails:

1. **Clear all caches**:
   ```bash
   cd android
   ./gradlew clean
   rm -rf .gradle
   rm -rf build/
   cd ..
   rm -rf node_modules
   npm install
   ```

2. **Check Java version**:
   ```bash
   java -version
   ```
   Should be Java 11 or higher

3. **Increase system memory**:
   - Close unnecessary applications
   - If on limited RAM, reduce JVM heap in `gradle.properties` to `-Xmx4096m`

4. **Check NDK installation**:
   ```bash
   echo %ANDROID_SDK_ROOT%
   ```
   NDK should be in: `%ANDROID_SDK_ROOT%\ndk\26.1.10909125`

### If App Still Crashes:

1. **Check logs**:
   ```bash
   adb logcat -s "BusRoute:*" "XBox:*" "RN:*"
   ```

2. **Error screen will show**: If data loading fails, you'll see an error message on the first screen

3. **Check JSON files**:
   - Verify `src/assets/final_buss.json` exists and is valid
   - Verify `src/assets/final_safe.json` exists and is valid
   - Both files should be properly formatted JSON

## Performance Tips

- File size of release APK should be < 100MB
- Build time should be 2-5 minutes on a modern system
- If slower, check system resource usage (RAM, CPU)

## Next Steps

1. Run the build command from Method 1
2. Install APK on device: `adb install android/app/build/outputs/apk/debug/app-debug.apk`
3. Launch app and verify it loads
4. Check logcat for any errors
5. If it works, proceed to release build

## Support Files

- `DatabaseService.ts` - Data initialization service (updated)
- `DataMigrationService.ts` - JSON data loading (improved error handling)
- `App.tsx` - App entry point (added initialization)
