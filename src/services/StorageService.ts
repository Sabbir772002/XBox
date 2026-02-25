import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SearchHistory {
  id: string;
  fromStopId: number;
  toStopId: number;
  fromStopName: string;
  toStopName: string;
  timestamp: number;
  routesFound: number;
}

export interface BookmarkedRoute {
  id: string;
  routeId: string;
  fromStopId: number;
  toStopId: number;
  fromStopName: string;
  toStopName: string;
  distance: number;
  fare: number;
  stopsCount?: number;
  timestamp: number;
}

class StorageService {
  private readonly HISTORY_KEY = '@search_history';
  private readonly BOOKMARK_KEY = '@bookmarked_routes';

  // ============ SEARCH HISTORY ============

  async addSearchHistory(
    fromStopId: number,
    toStopId: number,
    fromStopName: string,
    toStopName: string,
    routesFound: number
  ): Promise<void> {
    try {
      const history = await this.getSearchHistory();
      
      // Check if this search already exists
      const existingIndex = history.findIndex(
        h => h.fromStopId === fromStopId && h.toStopId === toStopId
      );

      if (existingIndex !== -1) {
        // Update timestamp and move to top
        history.splice(existingIndex, 1);
      }

      const newHistory: SearchHistory = {
        id: `${Date.now()}_${fromStopId}_${toStopId}`,
        fromStopId,
        toStopId,
        fromStopName,
        toStopName,
        timestamp: Date.now(),
        routesFound,
      };

      history.unshift(newHistory);

      // Keep only last 50 searches
      const limitedHistory = history.slice(0, 50);
      
      await AsyncStorage.setItem(this.HISTORY_KEY, JSON.stringify(limitedHistory));
      console.log('✓ Search history added');
    } catch (error) {
      console.error('Error adding search history:', error);
    }
  }

  async getSearchHistory(): Promise<SearchHistory[]> {
    try {
      const data = await AsyncStorage.getItem(this.HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
  }

  async clearSearchHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.HISTORY_KEY);
      console.log('✓ Search history cleared');
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }

  async deleteSearchHistoryItem(id: string): Promise<void> {
    try {
      const history = await this.getSearchHistory();
      const filtered = history.filter(h => h.id !== id);
      await AsyncStorage.setItem(this.HISTORY_KEY, JSON.stringify(filtered));
      console.log('✓ Search history item deleted');
    } catch (error) {
      console.error('Error deleting search history item:', error);
    }
  }

  // ============ BOOKMARKS ============

  async addBookmark(
    routeId: string,
    fromStopId: number,
    toStopId: number,
    fromStopName: string,
    toStopName: string,
    distance: number,
    stopsCount?: number
  ): Promise<boolean> {
    try {
      const bookmarks = await this.getBookmarks();

      // Check if already bookmarked
      const exists = bookmarks.some(
        b => b.routeId === routeId && b.fromStopId === fromStopId && b.toStopId === toStopId
      );

      if (exists) {
        return false; // Already bookmarked
      }

      const fare = 2.5 * distance;

      const newBookmark: BookmarkedRoute = {
        id: `${Date.now()}_${routeId}_${fromStopId}_${toStopId}`,
        routeId,
        fromStopId,
        toStopId,
        fromStopName,
        toStopName,
        distance,
        fare,
        stopsCount,
        timestamp: Date.now(),
      };

      bookmarks.unshift(newBookmark);
      await AsyncStorage.setItem(this.BOOKMARK_KEY, JSON.stringify(bookmarks));
      console.log('✓ Bookmark added');
      return true;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      return false;
    }
  }

  async removeBookmark(routeId: string, fromStopId?: number, toStopId?: number): Promise<void> {
    try {
      const bookmarks = await this.getBookmarks();
      const filtered = bookmarks.filter(
        b => {
          if (fromStopId !== undefined && toStopId !== undefined) {
            return !(b.routeId === routeId && b.fromStopId === fromStopId && b.toStopId === toStopId);
          }
          return b.routeId !== routeId;
        }
      );
      await AsyncStorage.setItem(this.BOOKMARK_KEY, JSON.stringify(filtered));
      console.log('✓ Bookmark removed');
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  }

  async isBookmarked(routeId: string, fromStopId: number, toStopId: number): Promise<boolean> {
    try {
      const bookmarks = await this.getBookmarks();
      return bookmarks.some(
        b => b.routeId === routeId && b.fromStopId === fromStopId && b.toStopId === toStopId
      );
    } catch (error) {
      console.error('Error checking bookmark:', error);
      return false;
    }
  }

  async getBookmarks(): Promise<BookmarkedRoute[]> {
    try {
      const data = await AsyncStorage.getItem(this.BOOKMARK_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting bookmarks:', error);
      return [];
    }
  }

  async clearBookmarks(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.BOOKMARK_KEY);
      console.log('✓ Bookmarks cleared');
    } catch (error) {
      console.error('Error clearing bookmarks:', error);
    }
  }
}

export default new StorageService();
