import React, { useState, useRef, useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, CheckCircle2, LayoutDashboard, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Card } from "../../ui/card";
import { Avatar } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { VizAIWebSocket, WebSocketResponse } from "../../../services/websocket";
import { getCurrentUser } from "../../../services/api";
import { toast } from "sonner";

interface Message {
  id: number;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
}

interface DatabaseContextBotProps {
  databaseName: string;
  databaseConnectionId?: string;
  projectName?: string;
  projectDescription?: string;
  projectDomain?: string;
  enhancedDescription?: string;
  userId?: string;
  onComplete: (context: {
    responses: Record<string, string>;
    suggestedDashboards: Array<{
      name: string;
      description: string;
      charts: string[];
    }>;
    kpis?: string[];
    kpisSummary?: string;
  }) => void;
}

export function DatabaseContextBot({ 
  databaseName, 
  databaseConnectionId,
  projectName,
  projectDescription,
  projectDomain,
  enhancedDescription,
  userId,
  onComplete 
}: DatabaseContextBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: `Perfect! Now that I have access to your selected tables, let me understand what insights you're looking for. This will help me create the most relevant dashboards for you! 🎯`,
      timestamp: new Date()
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [probableAnswers, setProbableAnswers] = useState<string[]>([]);
  const isCompletedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Initialize WebSocket connection
  const initWebSocket = async (): Promise<VizAIWebSocket | null> => {
    try {
      // Get user ID if not provided
      let currentUserId = userId;
      if (!currentUserId) {
        const userResponse = await getCurrentUser();
        if (!userResponse.success || !userResponse.data) {
          console.error('[DatabaseContextBot] Failed to get user information');
          return null;
        }
        currentUserId = userResponse.data.id;
      }

      setIsConnecting(true);
      const client = new VizAIWebSocket(currentUserId);
      let connectionEstablished = false;

      // Handle kpi_info responses
      client.on('kpi_info', (response: WebSocketResponse) => {
        console.log('[DatabaseContextBot] Received response:', response);
        console.log('[DatabaseContextBot] Questions asked:', response.state?.questions_asked_count);
        console.log('[DatabaseContextBot] Is completed flag:', isCompletedRef.current);

        // Prevent processing if already completed
        if (isCompletedRef.current) {
          console.log('[DatabaseContextBot] Already completed, ignoring response');
          return;
        }

        if (response.status === 'collecting') {
          // Show question to user
          const question = response.message;
          setCurrentQuestion(question);
          setQuestionsAsked(response.state?.questions_asked_count || 0);
          setProbableAnswers(response.probable_answers || []);
          
          // Add bot message with question
          addBotMessage(question);
        } else if (response.status === 'completed') {
          // KPI collection complete
          console.log('[DatabaseContextBot] KPI collection completed, setting completion flag');
          isCompletedRef.current = true;
          
          const state = response.state || {};
          const kpis = state.kpis || [];
          const kpisSummary = state.kpis_summary || "";
          setProbableAnswers([]);
          
          addBotMessage("Perfect! I've collected your KPIs and understand your data requirements. Thank you!");
          
          setTimeout(() => {
            // Disconnect WebSocket before calling onComplete to prevent any further messages
            if (client && client.isConnected()) {
              console.log('[DatabaseContextBot] Disconnecting WebSocket after completion');
              client.disconnect();
            }
            
            // Generate dashboard suggestions based on collected KPIs
            const suggestedDashboards = generateDashboardSuggestions(responses);
            
            // Complete with KPIs and dashboard suggestions
            onComplete({
              responses: responses,
              suggestedDashboards: suggestedDashboards,
              kpis: Array.isArray(kpis) ? kpis : [],
              kpisSummary: kpisSummary
            });
          }, 1500);
        } else if (response.status === 'error') {
          // Handle error
          console.error('[DatabaseContextBot] Error:', response.error);
          toast.error(response.error || response.message || "An error occurred");
          setIsTyping(false);
          setProbableAnswers([]);
          addBotMessage("I'm sorry, something went wrong. Please try again.");
        }
      });

      // Handle connection open
      client.onOpen(() => {
        console.log('[DatabaseContextBot] WebSocket connection established');
        connectionEstablished = true;
      });

      // Handle connection errors
      client.onError((error) => {
        console.error('[DatabaseContextBot] WebSocket error:', error);
        if (!connectionEstablished) {
          setConnectionError("Failed to connect to AI assistant. Please check your connection and try again.");
          setIsConnecting(false);
          setIsTyping(false);
        }
      });

      // Handle connection close
      client.onClose(() => {
        if (connectionEstablished && !client.isConnected()) {
          setConnectionError("Connection lost. Please try again.");
          setIsTyping(false);
        } else if (!connectionEstablished) {
          setConnectionError("Failed to establish connection. Please check the WebSocket server is running.");
          setIsConnecting(false);
          setIsTyping(false);
        }
      });

      // Connect WebSocket with timeout
      try {
        await Promise.race([
          client.connect(),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
          })
        ]);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (client.isConnected()) {
          setWsClient(client);
          setIsConnecting(false);
          return client;
        } else {
          throw new Error('Connection not established');
        }
      } catch (error: any) {
        console.warn('[DatabaseContextBot] WebSocket connection failed:', error.message);
        setConnectionError(error.message || "Connection timeout. Please ensure the WebSocket server is running.");
        setIsConnecting(false);
        return null;
      }
    } catch (error: any) {
      console.error('[DatabaseContextBot] Failed to initialize WebSocket:', error);
      setConnectionError(error.message || "Failed to initialize WebSocket connection.");
      setIsConnecting(false);
      return null;
    }
  };

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsClient) {
        wsClient.disconnect();
      }
    };
  }, [wsClient]);

  const addBotMessage = (content: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          type: "bot",
          content,
          timestamp: new Date()
        }
      ]);
      setIsTyping(false);
    }, 800);
  };

  const handleStart = async () => {
    setHasStarted(true);
    setConnectionError(null);
    setIsConnecting(true);
    
    // Connect via WebSocket
    const client = await initWebSocket();
    
    if (client && client.isConnected()) {
      setIsTyping(true);
      // Start kpi_info workflow with project context
      setTimeout(() => {
        client.kpiInfo({
          project_name: projectName,
          project_description: projectDescription,
          project_domain: projectDomain,
          product_description: enhancedDescription, // Has priority
          ...(databaseConnectionId ? { data_connection_id: databaseConnectionId } : {})
        });
      }, 500);
    } else {
      setConnectionError("Unable to connect to AI assistant. Please check that the WebSocket server is running and try again.");
      setIsConnecting(false);
      setIsTyping(false);
    }
  };

  const generateDashboardSuggestions = (userResponses: Record<string, string>) => {
    // Simulate AI analysis to generate dashboard suggestions
    const suggestions = [
      {
        name: "Executive Overview",
        description: "High-level KPIs and trends for quick decision making",
        charts: [
          "Revenue Trend (Line Chart)",
          "Key Metrics Summary (Cards)",
          "Performance vs Target (Bar Chart)",
          "Growth Rate (Area Chart)"
        ]
      },
      {
        name: "Detailed Analytics",
        description: "In-depth analysis of your key data points",
        charts: [
          "Customer Segmentation (Pie Chart)",
          "Regional Performance (Map/Bar Chart)",
          "Product Analysis (Bar Chart)",
          "Time Series Comparison (Line Chart)"
        ]
      },
      {
        name: "Operational Dashboard",
        description: "Day-to-day operational metrics and monitoring",
        charts: [
          "Daily Activity (Line Chart)",
          "Status Distribution (Pie Chart)",
          "Recent Transactions (Table)",
          "Alerts & Notifications (List)"
        ]
      }
    ];

    return suggestions;
  };

  const sendResponse = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return;
    }

    if (!wsClient || !wsClient.isConnected()) {
      toast.error("Not connected to AI assistant. Please wait for connection or try again.");
      return;
    }

    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: trimmed,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");
    setIsTyping(true);
    setResponses((prev) => ({
      ...prev,
      [`response_${Date.now()}`]: trimmed
    }));
    setProbableAnswers([]);

    const payload: Record<string, string> = {
      user_response: trimmed
    };

    if (databaseConnectionId) {
      payload.data_connection_id = databaseConnectionId;
    }

    wsClient.kpiInfo(payload);
  };

  const handleSendMessage = () => {
    sendResponse(userInput);
  };

  const handleKeyPress = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestedAnswer = (answer: string) => {
    sendResponse(answer);
  };

  const currentPlaceholder = currentQuestion 
    ? "Type your answer..."
    : "Type your answer...";

  return (
    <Card className="border border-border shadow-xl overflow-hidden">
      <div className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground">VizAI Assistant</h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {hasStarted 
                    ? questionsAsked > 0
                      ? `Question ${questionsAsked} of up to 5` 
                      : connectionError
                      ? "Connection error"
                      : "Starting conversation..."
                    : isConnecting 
                    ? "Connecting to AI assistant..." 
                    : "Understanding your database"}
                </p>
                {hasStarted && !connectionError && (
                  <Badge variant="outline" className="text-xs border-success/20 bg-success/10 text-success">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    DB Connected
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-muted/20">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${message.type === "user" ? "flex-row-reverse" : ""}`}
              >
                {message.type === "bot" && (
                  <Avatar className="w-8 h-8 bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </Avatar>
                )}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    message.type === "bot"
                      ? "bg-card border border-border text-foreground"
                      : "bg-gradient-to-r from-primary to-accent text-white"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <Avatar className="w-8 h-8 bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </Avatar>
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </motion.div>
          )}

          {connectionError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3"
            >
              <p className="text-sm text-destructive">{connectionError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setConnectionError(null);
                  setHasStarted(false);
                  isCompletedRef.current = false;
                  setMessages([{
                    id: 1,
                    type: "bot",
                    content: `Perfect! Now that I have access to your selected tables, let me understand what insights you're looking for. This will help me create the most relevant dashboards for you! 🎯`,
                    timestamp: new Date()
                  }]);
                }}
              >
                Try Again
              </Button>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-border bg-card">
          {!hasStarted ? (
            <Button
              onClick={handleStart}
              disabled={isConnecting}
              className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Connecting to AI assistant...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Let's Understand Your Data
                </>
              )}
            </Button>
          ) : (
            <>
              {probableAnswers.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {probableAnswers.map((answer, index) => (
                    <Button
                      key={`${answer}-${index}`}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSuggestedAnswer(answer)}
                      disabled={!wsClient || !wsClient.isConnected() || isTyping || !!connectionError}
                    >
                      {answer}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={currentPlaceholder}
                  className="flex-1 h-12"
                  disabled={isTyping || !currentQuestion || !wsClient || !wsClient.isConnected() || !!connectionError}
                  autoFocus
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isTyping || !currentQuestion || !wsClient || !wsClient.isConnected() || !!connectionError}
                  className="h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white disabled:opacity-50"
                >
                  {isTyping ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
