import { create } from 'zustand';
import type { ChartSpec } from '../services/websocket';

export interface ChartSuggestion {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  description: string;
  query: string;
  reasoning: string;
  dataSource?: string;
  dataConnectionId?: string;
  databaseId?: string;
  relevance?: number;
  spec?: ChartSpec;
  data?: any[];
  dataKeys?: {
    primary: string;
    secondary?: string;
  };
  xAxisKey?: string;
  isLoadingData?: boolean;
  dataError?: string;
  xAxisField?: string | null;
  yAxisField?: string | null;
  minMaxDates?: [string, string] | null;
}

export interface Message {
  id: number;
  type: 'user' | 'ai' | 'chart-suggestions' | 'database-prompt';
  content: string;
  chartSuggestions?: ChartSuggestion[];
}

interface ChartGenerationState {
  // Messages history
  messages: Message[];
  
  // Generated chart suggestions
  chartSuggestions: ChartSuggestion[];
  
  // Selected database
  selectedDatabase: string;
  
  // WebSocket state
  isConnected: boolean;
  isGenerating: boolean;
  
  // Chart workflow state
  chartWorkflowState: Record<string, any> | null;
  
  // Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: number, updates: Partial<Message>) => void;
  
  setChartSuggestions: (suggestions: ChartSuggestion[]) => void;
  addChartSuggestion: (suggestion: ChartSuggestion) => void;
  removeChartSuggestion: (id: string) => void;
  updateChartSuggestion: (id: string, updates: Partial<ChartSuggestion>) => void;
  
  setSelectedDatabase: (databaseId: string) => void;
  
  setIsConnected: (connected: boolean) => void;
  setIsGenerating: (generating: boolean) => void;
  
  setChartWorkflowState: (state: Record<string, any> | null) => void;
  
  // Clear all state (called on page navigation)
  clearState: () => void;
  
  // Initialize with default state
  initialize: () => void;
}

const defaultMessages: Message[] = [
  {
    id: 1,
    type: 'database-prompt',
    content: 'Hello! I\'m VizAI. To get started, please select which database you\'d like to generate charts from.'
  }
];

const initialState = {
  messages: defaultMessages,
  chartSuggestions: [],
  selectedDatabase: '',
  isConnected: false,
  isGenerating: false,
  chartWorkflowState: null,
};

export const useChartGenerationStore = create<ChartGenerationState>((set) => ({
  ...initialState,
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),
  
  setChartSuggestions: (suggestions) => set({ chartSuggestions: suggestions }),
  
  addChartSuggestion: (suggestion) => set((state) => ({
    chartSuggestions: [...state.chartSuggestions, suggestion]
  })),
  
  removeChartSuggestion: (id) => set((state) => ({
    chartSuggestions: state.chartSuggestions.filter(s => s.id !== id)
  })),
  
  updateChartSuggestion: (id, updates) => set((state) => ({
    chartSuggestions: state.chartSuggestions.map(s =>
      s.id === id ? { ...s, ...updates } : s
    )
  })),
  
  setSelectedDatabase: (databaseId) => set({ selectedDatabase: databaseId }),
  
  setIsConnected: (connected) => set({ isConnected: connected }),
  
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  
  setChartWorkflowState: (state) => set({ chartWorkflowState: state }),
  
  clearState: () => set(initialState),
  
  initialize: () => set((state) => ({
    ...initialState,
    // Keep selected database if already set
    selectedDatabase: state.selectedDatabase || initialState.selectedDatabase,
  })),
}));
