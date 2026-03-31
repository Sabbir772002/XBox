# Quick APK Build Instructions

## ⚡ Fast Build Commands

### Clean Build (Do this if you haven't built recently):
```bash
cd d:\DEV\Django\EE\XBox_Build
npm install
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### Quick Rebuild:
```bash
cd d:\DEV\Django\EE\XBox_Build
npx react-native run-android
```

### Build Release APK Only (No Install):
```bash
cd d:\DEV\Django\EE\XBox_Build\android
./gradlew assembleDebug
```

### Install APK Manually:
```bash
adb install -r d:\DEV\Django\EE\XBox_Build\android\app\build\outputs\apk\debug\app-debug.apk
```

## 📋 What Was Fixed

| Issue | Status | Fix |
|-------|--------|-----|
| Gradle out of memory | ✅ Fixed | Increased JVM heap to 6GB |
| App initialization crash | ✅ Fixed | Added error handling & loading screen |
| JSON data loading errors | ✅ Fixed | Better validation & error logging |
| Build optimization | ✅ Fixed | Enabled resource shrinking & parallel builds |
| Debug keystore missing | ✅ Ready | Already exists in android/app/ |

## 📲 What to Expect

When you build and run:
1. You should see "Loading data..." screen
2. App should load and show bus search screen
3. No crashes on startup
4. If there's an error, you'll see it on an error screen

## 🔍 Check Build Success

After running: `npx react-native run-android`

✅ Success indicators:
- App installs on device
- Shows loading screen briefly
- Bus search screen appears
- No console errors

❌ If it crashes:
- Check the error screen message
- Run: `adb logcat | grep "Error"` to see logs
- See BUILD_FIX_GUIDE.md for detailed troubleshooting

## 📁 Files Changed

1. `android/gradle.properties` - JVM memory settings
2. `src/App.tsx` - App initialization with error handling
3. `src/services/DataMigrationService.ts` - Improved data loading
4. `android/app/build.gradle` - Build optimizations

## 🚀 Next (After Successful Build)

For release build:
```bash
cd d:\DEV\Django\EE\XBox_Build\android
./gradlew assembleRelease
```

APK Location: `android/app/build/outputs/apk/release/app-release.apk`

