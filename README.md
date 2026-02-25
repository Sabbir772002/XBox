# XBox - React Native Bus Route Application

A [**React Native**](https://reactnative.dev) mobile application with TypeScript support, bottom tab navigation, local data persistence using SQLite, and Material Design icons for managing and searching bus routes.

## What This App Does

**XBox** is a mobile application designed for managing and searching bus routes. The app provides:

- 🚌 **Route Search**: Find bus routes with real-time search capabilities
- 🗺️ **Route Details**: View detailed information about specific bus routes, stops, and schedules
- 📌 **Bookmarks**: Save favorite routes for quick access
- 📱 **Offline Access**: Local SQLite database stores route information for offline use
- 🎯 **Multiple Screens**: Browse history, view bookmarks, search new routes, and see detailed route information
- 🎨 **Responsive UI**: Bottom tab navigation with smooth transitions and gradient designs

The app integrates with a Django backend (data-entry folder) for data management and synchronization. It's built with React Native to support both Android and iOS platforms from a single codebase.

---

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
│   ├── screens/          # Screen components (Route, Details, Bookmarks, History)
│   ├── navigation/       # Navigation setup
│   ├── services/         # Database and storage services
│   ├── types/            # TypeScript type definitions
│   ├── theme/            # UI theme and colors
│   └── App.tsx           # Root component
├── scripts/              # Build & utility scripts
├── data-entry/           # Data entry UI components
├── __tests__/            # Test files
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

---

## AI Tools & Development Assistance

### Tools Used:
- **GitHub Copilot** (Claude Haiku 4.5)
  - Code completion and suggestions
  - Function implementation assistance
  - Bug identification and fixing
  - Documentation generation
  - TypeScript type definitions and interfaces
  - React component structure recommendations

### Development Process:
- AI-assisted code generation for React Native components
- Intelligent debugging support for platform-specific issues
- Automated documentation and README creation
- Git workflow automation and repository setup
- Build configuration optimization

---

## What Was Learned

### Mobile Development Insights:
1. **React Native Architecture**: Understanding the bridge between JavaScript and native code, platform-specific differences between Android and iOS
2. **Navigation Patterns**: Implementing complex navigation with React Navigation's Stack and Bottom Tab navigators
3. **State Management**: Managing local and persistent state using AsyncStorage and SQLite
4. **TypeScript in Mobile**: Strong typing improves development speed and reduces runtime errors in mobile apps
5. **Database Design**: Designing efficient SQLite schemas for mobile applications with migration strategies
6. **Build Optimization**: APK/AAB generation, release builds, and code signing processes
7. **Development Workflow**: Hot reload/Fast Refresh significantly speeds up iterative development
8. **UI/UX Considerations**: Responsive design patterns for different screen sizes and orientations

### Technical Growth:
- Deep dive into React Native ecosystem and modern mobile development practices
- Understanding Gradle build system for Android and Xcode for iOS
- Database migrations and versioning strategies in mobile apps
- Performance optimization for resource-constrained mobile devices
- Integration of multiple libraries (SQLite, Vector Icons, AsyncStorage, Navigation)

---

## What Could Be Improved

### Performance Enhancements:
- [ ] Implement FlatList virtualization for large route lists to reduce memory usage
- [ ] Add code splitting and lazy loading for heavy components
- [ ] Optimize SQLite queries with proper indexing
- [ ] Implement image caching with react-native-fast-image

### Feature Additions:
- [ ] Real-time GPS tracking and route mapping with Mapbox or Google Maps
- [ ] Push notifications for route updates and delays
- [ ] Favorite routes with estimated arrival times
- [ ] User authentication and cloud synchronization
- [ ] Offline mode with data sync when connectivity returns
- [ ] Multi-language support (i18n)
- [ ] Accessibility improvements (WCAG compliance)

### Code Quality:
- [ ] Increase test coverage (currently minimal Jest tests)
- [ ] Add E2E testing with Detox for critical user flows
- [ ] Implement error boundaries for better error handling
- [ ] Add analytics and crash reporting (Firebase Crashlytics)
- [ ] Code refactoring to reduce component complexity
- [ ] Extract business logic into custom hooks

### UI/UX Improvements:
- [ ] Add loading skeletons and better loading states
- [ ] Implement dark mode support
- [ ] Add swipe gestures for navigation
- [ ] Improve error messages and empty state designs
- [ ] Add animation transitions between screens
- [ ] Implement search filters and advanced filtering options

### DevOps & Deployment:
- [ ] CI/CD pipeline setup (GitHub Actions)
- [ ] Automated testing on each commit
- [ ] Beta testing through TestFlight and Google Play Beta
- [ ] Analytics dashboard for user engagement
- [ ] Performance monitoring and logging
- [ ] Automated documentation updates

### Architecture:
- [ ] Move to Redux or Zustand for complex state management
- [ ] Implement clean architecture layering (presentation, domain, data)
- [ ] Add API abstraction layer for backend communication
- [ ] Implement dependency injection pattern
- [ ] Add comprehensive error handling middleware

---

## Future Roadmap

**v0.1.0**: Core features stabilization with bug fixes  
**v0.2.0**: Real-time GPS tracking and map integration  
**v0.3.0**: User authentication and cloud sync  
**v1.0.0**: Production release with full feature set

---

## Support

For issues and questions:
- Check the [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting) guide
- Review android/ios specific documentation
- Check CHANGELOG.md for recent updates
- Review DATABASE_MIGRATION_SUMMARY.md for schema information
