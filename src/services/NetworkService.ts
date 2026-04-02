import NetInfo from '@react-native-community/netinfo';

class NetworkService {
  private isOnline = true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  async initialize(): Promise<void> {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected ?? false;
      console.log(`📡 Network initialized - Online: ${this.isOnline}`);

      // Subscribe to network changes
      NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;

        if (wasOnline !== this.isOnline) {
          console.log(`📡 Network status changed - Online: ${this.isOnline}`);
          this.notifyListeners(this.isOnline);
        }
      });
    } catch (error) {
      console.error('Error initializing NetworkService:', error);
    }
  }

  /**
   * Check if device is currently online
   */
  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to network status changes
   */
  onChange(callback: (isOnline: boolean) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of network status change
   */
  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }

  /**
   * Perform an action with network retry
   */
  async withRetry<T>(
    action: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isOnline) {
          throw new Error('No internet connection');
        }
        return await action();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
        await new Promise<void>(resolve => setTimeout(() => resolve(), retryDelay));
      }
    }
    throw new Error('Max retries exceeded');
  }
}

export default new NetworkService();
