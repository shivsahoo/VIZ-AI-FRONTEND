/**
 * Chart Data Cache Utility
 * 
 * Provides caching for chart query results to reduce API calls.
 * Uses both in-memory cache (for fast access) and localStorage (for persistence).
 */

import { ChartData } from '../services/api';

interface CachedChartData {
  data: ChartData;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// In-memory cache for fast access
const memoryCache = new Map<string, CachedChartData>();

// Cache configuration
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_PREFIX = 'vizai_chart_cache_';
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries

/**
 * Generate a cache key from query parameters
 */
function generateCacheKey(
  chartId: string,
  datasourceConnectionId: string,
  query: string,
  fromDate?: string,
  toDate?: string
): string {
  // Normalize query by removing extra whitespace
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  
  // Create a hash-like key from all parameters
  const keyParts = [
    chartId,
    datasourceConnectionId,
    normalizedQuery,
    fromDate || '',
    toDate || ''
  ];
  
  // Simple hash function for the key
  const keyString = keyParts.join('|');
  return `${CACHE_PREFIX}${btoa(keyString).replace(/[+/=]/g, '')}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cached: CachedChartData): boolean {
  const now = Date.now();
  return (now - cached.timestamp) < cached.ttl;
}

/**
 * Get cached chart data
 */
export function getCachedChartData(
  chartId: string,
  datasourceConnectionId: string,
  query: string,
  fromDate?: string,
  toDate?: string
): ChartData | null {
  const cacheKey = generateCacheKey(chartId, datasourceConnectionId, query, fromDate, toDate);
  
  // Check in-memory cache first
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && isCacheValid(memoryCached)) {
    return memoryCached.data;
  }
  
  // Check localStorage
  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const cached: CachedChartData = JSON.parse(stored);
      if (isCacheValid(cached)) {
        // Update memory cache
        memoryCache.set(cacheKey, cached);
        return cached.data;
      } else {
        // Remove expired cache
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    console.warn('Error reading from cache:', error);
  }
  
  return null;
}

/**
 * Store chart data in cache
 */
export function setCachedChartData(
  chartId: string,
  datasourceConnectionId: string,
  query: string,
  data: ChartData,
  ttl: number = DEFAULT_TTL,
  fromDate?: string,
  toDate?: string
): void {
  const cacheKey = generateCacheKey(chartId, datasourceConnectionId, query, fromDate, toDate);
  
  const cached: CachedChartData = {
    data,
    timestamp: Date.now(),
    ttl
  };
  
  // Store in memory cache
  memoryCache.set(cacheKey, cached);
  
  // Clean up old memory cache entries if needed
  if (memoryCache.size > MAX_CACHE_SIZE) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) {
      memoryCache.delete(firstKey);
    }
  }
  
  // Store in localStorage
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cached));
    
    // Clean up expired localStorage entries periodically
    cleanupExpiredCache();
  } catch (error) {
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded, clearing old cache entries');
      clearOldCacheEntries();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cached));
      } catch (retryError) {
        console.warn('Failed to store in cache after cleanup:', retryError);
      }
    } else {
      console.warn('Error storing in cache:', error);
    }
  }
}

/**
 * Clear expired cache entries from localStorage
 */
function cleanupExpiredCache(): void {
  try {
    const keysToRemove: string[] = [];
    const now = Date.now();
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const cached: CachedChartData = JSON.parse(stored);
            if (!isCacheValid(cached)) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // If we can't parse, remove it
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      memoryCache.delete(key);
    });
  } catch (error) {
    console.warn('Error cleaning up cache:', error);
  }
}

/**
 * Clear old cache entries when storage is full
 */
function clearOldCacheEntries(): void {
  try {
    const entries: Array<{ key: string; timestamp: number }> = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const cached: CachedChartData = JSON.parse(stored);
            entries.push({ key, timestamp: cached.timestamp });
          }
        } catch {
          // Skip invalid entries
        }
      }
    }
    
    // Sort by timestamp (oldest first) and remove half of them
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.floor(entries.length / 2);
    
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
      memoryCache.delete(entries[i].key);
    }
  } catch (error) {
    console.warn('Error clearing old cache entries:', error);
  }
}

/**
 * Clear cache for a specific chart
 */
export function clearChartCache(
  chartId: string,
  datasourceConnectionId: string,
  query: string,
  fromDate?: string,
  toDate?: string
): void {
  const cacheKey = generateCacheKey(chartId, datasourceConnectionId, query, fromDate, toDate);
  memoryCache.delete(cacheKey);
  try {
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('Error clearing cache:', error);
  }
}

/**
 * Clear all chart caches
 */
export function clearAllChartCache(): void {
  memoryCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Error clearing all cache:', error);
  }
}

