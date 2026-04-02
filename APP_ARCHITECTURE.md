# BUSD App Architecture & Data Flow

## 📋 Overview
BUSD is a React Native bus route search app that fetches and manages three main types of data:
1. **Buses** - Bus information and their routes
2. **Stops** - Bus stop locations and details  
3. **Distances** - Distance between stops

---

## 🔄 Data Types & Storage

### 1. **BUSES** 🚌
**What:** Bus name (English/Bangla), service type, stops list

**Where Stored:**
- Firebase: `Bus Data` node
- Local Cache: AsyncStorage `@cached_buses`
- Memory: `DataMigrationService.busData` (array)

**Which Files Handle It:**
- `FirebaseService.ts` - Fetches from Firebase
- `DataMigrationService.ts` - Processes and stores in memory
- `DatabaseService.ts` - Queries the in-memory data
- Screens: `BusListScreen.tsx`, `RouteDetailsScreen.tsx`

---

### 2. **STOPS** 🛑
**What:** Stop ID, name (English/Bangla), latitude/longitude coordinates

**Where Stored:**
- Firebase: `Stop Data` node
- Local Cache: AsyncStorage `@cached_stops`
- Memory: `DataMigrationService.stopData` (Map)
- Nested: `DataMigrationService.stopsByName` (normalized name → Stop mapping)
- Coordinates: `DataMigrationService.stopCoordinatesById` (ID → [lat,lon])

**Which Files Handle It:**
- `FirebaseService.ts` - Fetches stop data
- `DataMigrationService.ts` - Indexes stops by name & coordinates
- `DatabaseService.ts` - Provides query methods
- `HaversineService.ts` - Calculates distance using coordinates
- Screens: `RouteSearchScreen.tsx`, `DetailsScreen.tsx`

---

### 3. **DISTANCES** 📏
**What:** Distance values between stop pairs (e.g., "Gabtoli-Technical": 795.7 km)

**Where Stored:**
- Firebase: `Dist Data` node (array format: `[{"A-B": 123}, {"C-D": 456}]`)
- Local Cache: AsyncStorage `@cached_distances`
- Memory: Two maps in `DataMigrationService`
  - `distanceData` - Local/cached distances
  - `firebaseDistanceData` - Firebase distances

**Which Files Handle It:**
- `FirebaseService.ts` - Fetches and normalizes array→object format
- `ApiService.ts` - Has alternate distance fetch method
- `DistanceService.ts` - Core distance lookup & fallback to Haversine
- `DataMigrationService.ts` - Consolidates distance data
- `HaversineService.ts` - Calculates distance as fallback

---

## 🔃 Data Flow Priority

### **Initialization Flow** (App.tsx → DatabaseService)
```
1. App starts
   ↓
2. App.tsx calls: DatabaseService.initialize()
   ↓
3. Calls: DataMigrationService.loadDataFromJSON()
   ↓
4. Priority order:
   a) Load from AsyncStorage cache (immediate)
   b) If no cache: Load from Firebase (background)
   c) If Firebase fails: Load from bundled JSON files
```

### **Caching Strategy - PRIORITY ORDER**
```
┌─────────────────────────────────────┐
│  1️⃣ AsyncStorage Cache (Fastest)   │
│     ↓ (if expired or empty)         │
│  2️⃣ Firebase (Network - Best Data)  │
│     ↓ (if timeout/error)            │
│  3️⃣ Bundled JSON (Fallback)         │
└─────────────────────────────────────┘
```

**Cache Duration:** 1 hour (then refreshes next app load)

---

## 📁 Service Files & Their Responsibilities

| File | Responsibility |
|------|-----------------|
| **FirebaseService.ts** | 🔥 Direct Firebase API calls, fetches Buses/Stops/Distances, array→object conversion |
| **ApiService.ts** | Alternate distance fetching with caching, handles both array & object formats |
| **DataMigrationService.ts** | 🎯 **Master Data Manager** - consolidates all data, handles cache, Firebase + JSON loading, normalizes stop names |
| **DatabaseService.ts** | 📊 Query interface - searches buses/stops, finds routes, calculates fares |
| **DistanceService.ts** | 📏 Distance lookup wrapper - returns min distance if both directions exist, fallback to Haversine |
| **HaversineService.ts** | 📍 Calculates distance using lat/long (fallback when distance data missing) |
| **StorageService.ts** | 💾 Stores user data - search history, bookmarks (AsyncStorage) |
| **NetworkService.ts** | 🌐 Checks internet connectivity |

---

## 🔄 How Distance Lookup Works

```
Query: getDistance("Gabtoli", "Technical")
   ↓
1. Check DistanceService
   ├─ Try both directions: "Gabtoli-Technical" & "Technical-Gabtoli"
   ├─ Return MINIMUM if both exist
   └─ Return whichever exists if one found
   ↓
2. Check Firebase (via FirebaseService)
   ├─ Fetch both directions
   ├─ Return MINIMUM if both exist
   └─ Return whichever exists if one found
   ↓
3. Fallback: Haversine Formula
   ├─ Get coordinates of both stops
   ├─ Calculate distance = √(Δlat² + Δlon²) * 111km
   └─ Return calculated distance (estimated)
   ↓
4. Final: Return 0 (not found)
```

---

## 🎯 How Route Search Works

**User Action:** Search from "Gabtoli" to "Technical"

```
RouteSearchScreen.tsx
   ↓
1. DatabaseService.findRoutesMatching(
     fromStopName, 
     toStopName
   )
   ↓
2. DatabaseService searches:
   - Finds all buses containing "Gabtoli"
   - Finds all buses containing "Technical"
   - Finds buses that have BOTH stops
   ↓
3. For each matching bus:
   - Get stop order from bus route
   - Get segment distances using DistanceService
   - Calculate total journey distance
   - Calculate fare
   ↓
4. Return Route[] with:
   - Bus name
   - Stops between origin & destination
   - Segment distances
   - Total distance
   - Estimated fare
   ↓
RouteDetailsScreen.tsx displays the result
```

---

## 💾 Local Storage (AsyncStorage)

### User Data Storage
| Key | Content | File |
|-----|---------|------|
| `@search_history` | JSON array of past searches | StorageService.ts |
| `@bookmarked_routes` | JSON array of saved routes | StorageService.ts |
| `@cached_buses` | Bus data from Firebase/JSON | DataMigrationService.ts |
| `@cached_stops` | Stop data from Firebase/JSON | DataMigrationService.ts |
| `@cached_distances` | Distance pairs from all sources | DataMigrationService.ts |
| `@cache_timestamp` | When cache was last updated | DataMigrationService.ts |

---

## 🌐 Data Format Handling

### **New Distance Format** (Array)
```json
[
  { "Gabtoli-Technical": 795.7 },
  { "Technical-Ansar Camp": 1105.3 },
  { "Ansar Camp-Mirpur 1": 784 }
]
```
✅ Handled by: `FirebaseService.normalizeDistancePayload()`
Converts to: `{ "Gabtoli-Technical": 795.7, "Technical-Ansar Camp": 1105.3, ... }`

### **Old Distance Format** (Object)
```json
{
  "Gabtoli-Technical": 795.7,
  "Technical-Ansar Camp": 1105.3
}
```
✅ Also supported by all distance services

---

## 🔐 Data Validation

### Distance Validation
- ✅ Accept: `0` (same location), positive numbers
- ❌ Reject: `null`, `undefined`, negative numbers

### Stop Match Logic
- Normalizes names: lowercase + remove special chars
- Supports partial matching
- Supports both English & Bangla names

### Bus Route Matching
- Finds buses that have BOTH origin AND destination stops
- Matches stop order to ensure valid journey

---

## 📲 Screen Data Flow

### RouteSearchScreen
```
Input: From Stop, To Stop
   ↓ calls DatabaseService.findRoutesMatching()
   ↓ calls DistanceService for each segment
Output: List of routes with distances & fares
```

### RouteDetailsScreen
```
Input: Selected route (Bus ID, From, To)
   ↓ calls DatabaseService to get full bus info
   ↓ processes stops in route
   ↓ calls DistanceService for each segment
Output: Detailed route with all stops
```

### HistoryScreen
```
Reads: StorageService.getSearchHistory()
Output: List of past searches (max 20)
Actions: Can re-search from history
```

### BookmarkScreen
```
Reads: StorageService.getBookmarkedRoutes()
Output: List of saved routes
Actions: Can view/delete/re-search
```

### BusListScreen
```
Reads: DatabaseService.getAllBuses()
Output: List of all buses
Actions: Can view bus details, routes
```

### SettingsScreen
```
Actions:
- Clear cache
- Force sync from Firebase
- Toggle dark mode
Calls: DataMigrationService.clearCache()
       DataMigrationService.initialize()
```

---

## 🚀 App Life Cycle

```
App Start (App.tsx)
   ↓
1. Initialize Services
   - NetworkService (check internet)
   - ThemeProvider (load theme)
   - DatabaseService (load data)
   ↓
2. DatabaseService.initialize()
   → Calls DataMigrationService.loadDataFromJSON()
   ↓
3. DataMigrationService.loadDataFromJSON()
   → Try AsyncStorage cache (1 hour TTL)
   → Background: Fetch Firebase updates
   → Fallback: Load bundled JSON
   ↓
4. Data Now In Memory
   - busData[]
   - stopData Map
   - firebaseDistanceData Map
   - distanceData Map
   ↓
5. App Ready
   - Screens can query DatabaseService
   - DatabaseService queries in-memory data
   - No network calls for basic queries
   - Network calls only for Firebase updates
```

---

## 🎬 Example: Complete Route Search Flow

```
USER: "Search routes from Dhanmondi to Mirpur"
   ↓
1. RouteSearchScreen
   - Input: "Dhanmondi" → "Mirpur"
   ↓
2. DatabaseService.findRoutesMatching()
   - Query DataMigrationService.stopsByName for "Dhanmondi" → Stop ID: 15
   - Query DataMigrationService.stopsByName for "Mirpur" → Stop ID: 48
   - Loop through DataMigrationService.busData[]
   - Find buses with both Stop 15 and Stop 48
   ↓
3. For Bus #3 (BRT):
   - Get stoppages: [...Dhanmondi(order:2), ..., Mirpur(order:7)]
   - Stops to show: 5 intermediate stops
   - Journal distance segments:
     * Dhanmondi → Stop1: getDistance() → 2.5 km
     * Stop1 → Stop2: getDistance() → 1.8 km
     * ... (DistanceService handles this)
   - Total: 15.3 km
   - Fare: Calculate based on distance
   ↓
4. Display Route
   RouteDetailsScreen shows:
   - Bus name: "BRT"
   - Pattern: Dhanmondi → Mirpur
   - 5 intermediate stops
   - Total distance: 15.3 km
   - Estimated fare: 45 BDT
   ↓
5. User Action
   - Can bookmark route → StorageService.addBookmark()
   - Can view on map → RouteMap component
   - Can share → Share API
```

---

## 🔍 Key Design Decisions

1. **In-Memory Caching** - All data loaded into memory for fast queries
2. **Dual Maps for Stops** - Both by ID and by name for flexible searching
3. **Min Distance Strategy** - Returns smaller value if both directions exist
4. **Fallback Chain** - Cache → Firebase → JSON → Haversine
5. **Background Updates** - Firebase updates happen in background while cache is used
6. **Normalized Keys** - Distance keys stored with multiple variations for flexible lookups

---

## 📊 Size of Data in Memory

- **Buses:** ~500-1000 objects
- **Stops:** ~150-200 objects  
- **Distances:** ~800-1000+ key-value pairs
- **Cache Size:** ~500KB-2MB (depending on data)
- **Memory Impact:** Very low, suitable for mobile

---

## 🐛 Debugging Tips

To check what's loaded:
```typescript
// Check buses
console.log(DataMigrationService.busData.length)

// Check stops
console.log(DataMigrationService.stopData.size)

// Check distances
console.log(DataMigrationService.distanceData.size)
console.log(DataMigrationService.firebaseDistanceData.size)

// Test distance lookup
DistanceService.getDistance("Dhanmondi", "Mirpur")

// Check cache status
StorageService.getCacheStatus()
```

---

This architecture ensures **fast, offline-capable route searches** while maintaining **data freshness** through background Firebase syncing. 🎯
