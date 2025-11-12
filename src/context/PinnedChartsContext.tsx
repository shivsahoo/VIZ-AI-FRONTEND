/**
 * PinnedChartsContext
 * 
 * Global state management for user's pinned charts.
 * Provides functionality to pin/unpin charts for quick access.
 * 
 * @context
 * @example
 * ```tsx
 * // Wrap app with provider
 * <PinnedChartsProvider>
 *   <App />
 * </PinnedChartsProvider>
 * 
 * // Use in components
 * const { pinnedCharts, togglePin } = usePinnedCharts();
 * ```
 */

import { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Data structure for a pinned chart
 */
export interface PinnedChartData {
  /** Unique chart identifier */
  id: number;
  /** Chart name/title */
  name: string;
  /** Chart description */
  description: string;
  /** Last update timestamp (human-readable) */
  lastUpdated: string;
  /** Type of chart visualization */
  chartType: 'line' | 'bar' | 'pie' | 'area';
  /** Chart category/tag */
  category: string;
  /** Associated dashboard name */
  dashboardName: string;
  /** Data source name */
  dataSource: string;
}

/**
 * Context API interface
 */
interface PinnedChartsContextType {
  /** Array of all pinned charts */
  pinnedCharts: PinnedChartData[];
  /** Check if a chart is pinned */
  isPinned: (chartId: number) => boolean;
  /** Add a chart to pins */
  pinChart: (chart: PinnedChartData) => void;
  /** Remove a chart from pins */
  unpinChart: (chartId: number) => void;
  /** Toggle pin state for a chart */
  togglePin: (chart: PinnedChartData) => void;
}

/**
 * Create context with undefined default
 * Ensures proper error handling when used outside provider
 */
const PinnedChartsContext = createContext<PinnedChartsContextType | undefined>(undefined);

/**
 * Provider component for pinned charts context
 * Manages state and provides methods for pinning/unpinning charts
 * 
 * TODO: Persist to localStorage for cross-session persistence
 * TODO: Sync with backend API when available
 */
export function PinnedChartsProvider({ children }: { children: ReactNode }) {
  /**
   * State: Array of pinned charts
   * Initialized with mock data for development
   */
  const [pinnedCharts, setPinnedCharts] = useState<PinnedChartData[]>([
    {
      id: 1,
      name: 'Revenue Trend',
      description: 'Monthly revenue tracking with forecasts',
      lastUpdated: '2 hours ago',
      chartType: 'line',
      category: 'Finance',
      dashboardName: 'Revenue Overview',
      dataSource: 'Sales Database'
    },
    {
      id: 2,
      name: 'Product Distribution',
      description: 'Sales breakdown by product category',
      lastUpdated: '3 hours ago',
      chartType: 'pie',
      category: 'Sales',
      dashboardName: 'Sales Performance',
      dataSource: 'Inventory DB'
    },
    {
      id: 3,
      name: 'User Growth',
      description: 'Daily active users over the last quarter',
      lastUpdated: '5 hours ago',
      chartType: 'area',
      category: 'Analytics',
      dashboardName: 'Customer Analytics',
      dataSource: 'Analytics DB'
    },
    {
      id: 4,
      name: 'Monthly Sales',
      description: 'Comparison of sales across months',
      lastUpdated: '1 day ago',
      chartType: 'bar',
      category: 'Sales',
      dashboardName: 'Sales Performance',
      dataSource: 'Sales Database'
    }
  ]);

  /**
   * Check if a chart is currently pinned
   * @param chartId - ID of chart to check
   * @returns true if chart is pinned, false otherwise
   */
  const isPinned = (chartId: number) => {
    return pinnedCharts.some(chart => chart.id === chartId);
  };

  /**
   * Add a chart to pinned charts
   * Prevents duplicate pins
   * @param chart - Chart data to pin
   */
  const pinChart = (chart: PinnedChartData) => {
    if (!isPinned(chart.id)) {
      setPinnedCharts(prev => [...prev, chart]);
      // TODO: Persist to localStorage
      // TODO: Sync with backend API
    }
  };

  /**
   * Remove a chart from pinned charts
   * @param chartId - ID of chart to unpin
   */
  const unpinChart = (chartId: number) => {
    setPinnedCharts(prev => prev.filter(chart => chart.id !== chartId));
    // TODO: Persist to localStorage
    // TODO: Sync with backend API
  };

  /**
   * Toggle pin state for a chart
   * Pins if unpinned, unpins if pinned
   * @param chart - Chart data to toggle
   */
  const togglePin = (chart: PinnedChartData) => {
    if (isPinned(chart.id)) {
      unpinChart(chart.id);
    } else {
      pinChart(chart);
    }
  };

  return (
    <PinnedChartsContext.Provider value={{ pinnedCharts, isPinned, pinChart, unpinChart, togglePin }}>
      {children}
    </PinnedChartsContext.Provider>
  );
}

/**
 * Custom hook to access pinned charts context
 * Must be used within PinnedChartsProvider
 * 
 * @throws Error if used outside of PinnedChartsProvider
 * @returns PinnedChartsContext API
 * 
 * @example
 * ```tsx
 * const { pinnedCharts, isPinned, togglePin } = usePinnedCharts();
 * 
 * <Button onClick={() => togglePin(chart)}>
 *   {isPinned(chart.id) ? 'Unpin' : 'Pin'}
 * </Button>
 * ```
 */
export function usePinnedCharts() {
  const context = useContext(PinnedChartsContext);
  if (context === undefined) {
    throw new Error('usePinnedCharts must be used within a PinnedChartsProvider');
  }
  return context;
}

