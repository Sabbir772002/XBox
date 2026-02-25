# MyApp - React Native Application

A [**React Native**](https://reactnative.dev) mobile application with TypeScript support, bottom tab navigation, local data persistence using SQLite, and Material Design icons.

## Project Overview

**Version**: 0.0.1  
**Framework**: React Native 0.81.0  
**Language**: TypeScript  
**Platforms**: Android & iOS

### Tech Stack

- **UI**: React 19.1.0, React Navigation (Native Stack + Bottom Tabs)
- **Storage**: AsyncStorage, SQLite Storage
- **Design**: Linear Gradient, Vector Icons
- **Build Tools**: Metro, Babel, ESLint, Jest
- **Backend**: Django integration available via `/data-entry` folder
- **Database**: SQLite with migration support

## Prerequisites

- **Node.js**: >= 18
- **npm** or **yarn**
- **Java JDK**: For Android builds
- **Android SDK**: API level 21 or higher
- **CocoaPods**: For iOS builds (macOS only)

## Installation

```sh
# Install dependencies
npm install

# or using Yarn
yarn install
```

## Development

### Step 1: Start Metro Dev Server

```sh
npm start
# or
yarn start
```

### Step 2: Run on Device/Emulator

#### Android

```sh
npm run android
# or
yarn android
```

#### iOS

First, install CocoaPods dependencies:

```sh
bundle install
bundle exec pod install
```

Then run:

```sh
npm run ios
# or
yarn ios
```

## Building for Production

### Generate Android APK

To build a release APK for Android:

```sh
cd android
./gradlew assembleRelease
```

The APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Generate Android AAB (Google Play)

To build an Android App Bundle for distribution on Google Play:

```sh
cd android
./gradlew bundleRelease
```

The AAB will be located at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Build iOS App

```sh
cd ios
xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start Metro dev server |
| `npm run android` | Build and run on Android |
| `npm run ios` | Build and run on iOS |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |

## Project Structure

```
MyApp/
├── android/              # Android native code & build config
├── ios/                  # iOS native code & build config
├── src/                  # Source code
├── scripts/              # Build & utility scripts
├── data-entry/           # Data entry UI components
├── __tests__/            # Test files
├── App.tsx               # Root application component
├── index.js              # Entry point
├── package.json          # Dependencies & scripts
└── README.md             # This file
```

## Development Workflow

1. **Fast Refresh**: Changes to code are automatically reflected.
   - **Android**: Press `R` twice or access Dev Menu with `Ctrl+M`
   - **iOS**: Press `R` in Simulator

2. **Debugging**: Use React Developer Tools or built-in dev menus

3. **Local Storage**: Data persists using AsyncStorage & SQLite

## Database Migration

Database migrations are documented in:
```
DATABASE_MIGRATION_SUMMARY.md
```

Review this file to understand schema changes and setup requirements.

## Troubleshooting

### Metro bundler issues
Clear cache and restart:
```sh
npm start -- --reset-cache
```

### Android build failures
```sh
cd android
./gradlew clean
cd ..
npm run android
```

### iOS build failures
```sh
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npm run ios
```

### Metro connection issues
Check that Metro is running and accessible on port 8081.

## Resources

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [React Navigation Guide](https://reactnavigation.org/)
- [Android Build Guide](https://reactnative.dev/docs/build-app-and-release)
- [iOS Build Guide](https://reactnative.dev/docs/build-app-and-release)
- [SQLite Storage](https://github.com/andpor/react-native-sqlite-storage)

## Support

For issues and questions:
- Check the [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting) guide
- Review android/ios specific documentation
- Check CHANGELOG.md for recent updates
