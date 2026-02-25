# Changelog - Bus Route Finder

## Version 1.1 (Upcoming)

### ✅ Fixed Issues:

**1. Typing & Suggestions UX** 
- ✅ **Issue**: Modal was blocking text input while showing suggestions
- ✅ **Fix**: Changed from full-screen modal to inline dropdown suggestions
- ✅ **Result**: Users can now type continuously while seeing suggestions appear below the input field

**2. Bidirectional Route Search**
- ✅ **Issue**: Only showed routes in one direction (A → B)
- ✅ **Fix**: Now searches both directions (A → B and B → A) simultaneously
- ✅ **Result**: Users see all available routes regardless of direction without the word "Reverse"

**3. Distance Calculation**
- ✅ **Issue**: Showing cumulative distance from route start
- ✅ **Fix**: Now shows relative distance from source stop to destination
- ✅ **Result**: Accurate distance between selected stops only

**4. Vector Icons**
- ✅ **Issue**: Icons not rendering properly
- ✅ **Fix**: Added `react-native-vector-icons/fonts.gradle` to [`../../../d:/DEV/Django/MAD/MyApp/android/app/build.gradle`](../../../d:/DEV/Django/MAD/MyApp/android/app/build.gradle )
- ✅ **Result**: All Ionicons display correctly

### 🔄 Changes Made:

#### RouteSearchScreenNew.tsx
```typescript
// BEFORE: Only searched one direction
const routes = await DatabaseService.getRoutesBetweenStops(fromStopId, toStopId);

// AFTER: Searches both directions
const forwardRoutes = await DatabaseService.getRoutesBetweenStops(fromStopId, toStopId);
const reverseRoutes = await DatabaseService.getRoutesBetweenStops(toStopId, fromStopId);
const allRoutes = [...forwardRoutes, ...reverseRoutes];
```

#### RouteDetailsScreen.tsx
```typescript
// BEFORE: Showing cumulative distance
<Text>{stop.distance.toFixed(1)} km from start</Text>

// AFTER: Showing relative distance
const relativeDistance = stop.distance - sourceDistance;
<Text>{relativeDistance.toFixed(1)} km from source</Text>
```

#### build.gradle
```gradle
// ADDED: Vector icons fonts
apply from: file("../../node_modules/react-native-vector-icons/fonts.gradle")

// ADDED: Universal APK for all devices
splits {
    abi {
        enable true
        universalApk true
        include "armeabi-v7a", "arm64-v8a"
    }
}
```

### 📱 User Experience Improvements:

**Before:**
1. Type "Gab" → Modal opens → Can't type more → Must click suggestion
2. Search Gabtoli → Mirpur: Shows 3 routes
3. Distance shows "5.2 km from start" (confusing)
4. Icons show as boxes/placeholders

**After:**
1. Type "Gab" → Dropdown appears → Continue typing "toli" → Suggestions filter → Click to select
2. Search Gabtoli → Mirpur: Shows 6 routes (both directions)
3. Distance shows "5.2 km from source" (clear and accurate)
4. Icons display beautifully

### 🎯 Technical Details:

**Bidirectional Search Logic:**
- Queries database twice (from→to and to→from)
- Merges results and removes duplicates
- Each route naturally shows its direction through stop names
- No "Reverse" label needed - route names are self-explanatory

**Dropdown vs Modal:**
- Dropdown: Non-blocking, positioned below input
- Modal: Blocking, covers entire screen
- Dropdown allows continuous typing and filtering
- Better UX on mobile devices

---

## Version 1.0 (Initial Release)

### Features:
- ✅ Search routes between two stops
- ✅ SQLite database integration
- ✅ Autocomplete suggestions
- ✅ Route details with stop-by-stop information
- ✅ Bengali language support
- ✅ Clean, modern UI with gradient headers

---

## Future Enhancements (Planned):

- [ ] Favorite routes
- [ ] Recent searches
- [ ] Offline mode indicator
- [ ] Bus fare estimation
- [ ] Real-time updates
- [ ] Share route feature
- [ ] Dark mode
- [ ] Multiple language support

---

**Last Updated:** October 13, 2025
