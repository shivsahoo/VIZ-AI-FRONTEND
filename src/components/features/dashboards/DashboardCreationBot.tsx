import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import { Card } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Avatar } from "../../ui/avatar";
import { VizAIWebSocket, WebSocketResponse } from "../../../services/websocket";
import { getCurrentUser } from "../../../services/api";
import { toast } from "sonner";

interface Message {
  id: number;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
}

interface DashboardCreationBotProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description?: string;
    enhancedDescription?: string;
    state?: Record<string, any>;
  }) => void;
  projectId?: string;
  projectName?: string;
}

export function DashboardCreationBot({ isOpen, onClose, onCreate, projectId, projectName }: DashboardCreationBotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addBotMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, type: "bot", content, timestamp: new Date() },
    ]);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, type: "user", content, timestamp: new Date() },
    ]);
  }, []);

  const handleDashboardResponse = useCallback((response: WebSocketResponse) => {
    setIsTyping(false);
    setConnectionError(null);

    const state = response.state || {};

    if (response.status === "collecting") {
      const question = response.message;
      setCurrentQuestion(question || null);
      setQuestionsAsked(state.questions_asked_count || 0);

      if (question) {
        addBotMessage(question);
      }
    } else if (response.status === "completed") {
      setIsCompleted(true);
      setCurrentQuestion(null);

      const name = state.name || "New Dashboard";
      const enhancedDescription = state.enhanced_description || null;
      const description = enhancedDescription || state.description || "";
      const summary = response.message || `Dashboard "${name}" information collected successfully!`;

      addBotMessage(summary);

      setTimeout(() => {
        onCreate({
          name,
          description,
          enhancedDescription: enhancedDescription || undefined,
          state,
        });
      }, 1200);
    } else if (response.status === "error") {
      const errorMessage = response.error || response.message || "Something went wrong while creating the dashboard.";
      setConnectionError(errorMessage);
      addBotMessage(`⚠️ ${errorMessage}`);
    }
  }, [onCreate, addBotMessage]);

  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          id: 1,
          type: "bot",
          content: projectName
            ? `Hi! 👋 I'm here to help you create the "${projectName}" dashboard. Let's go through a few quick questions.`
            : "Hi! 👋 I'm your VizAI assistant. I'll help you create a new dashboard through a quick conversation. Let's get started!",
          timestamp: new Date(),
        },
      ]);
      setUserInput("");
      setIsTyping(false);
      setConnectionError(null);
      setHasStarted(false);
      setCurrentQuestion(null);
      setQuestionsAsked(0);
      setIsCompleted(false);
    } else {
      setMessages([]);
      setUserInput("");
      setHasStarted(false);
      setCurrentQuestion(null);
      setQuestionsAsked(0);
      setConnectionError(null);
      setIsCompleted(false);
    }
  }, [isOpen, projectName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, connectionError]);

  useEffect(() => {
    return () => {
      if (wsClient) {
        wsClient.off("dashboard_creation", handleDashboardResponse);
        wsClient.disconnect();
      }
    };
  }, [wsClient, handleDashboardResponse]);

  const initWebSocket = async (): Promise<VizAIWebSocket | null> => {
    if (!projectId) {
      setConnectionError("Project ID is required to create a dashboard. Please try again from a project workspace.");
      return null;
    }

    try {
      if (wsClient && wsClient.isConnected()) {
        return wsClient;
      }

      setIsConnecting(true);
      setConnectionError(null);

      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const response = await getCurrentUser();
        if (!response.success || !response.data?.id) {
          throw new Error("Unable to determine current user");
        }
        resolvedUserId = response.data.id;
        setUserId(resolvedUserId);
      }

      const client = new VizAIWebSocket(resolvedUserId);

      client.on("dashboard_creation", handleDashboardResponse);
      client.onError((error) => {
        console.error("[DashboardCreationBot] WebSocket error:", error);
        setConnectionError(error.message || "WebSocket connection error");
        setIsTyping(false);
        setIsConnecting(false);
      });
      client.onClose(() => {
        setIsTyping(false);
        setWsClient(null);
      });

      await client.connect();
      setWsClient(client);
      setIsConnecting(false);
      return client;
    } catch (error: any) {
      console.error("[DashboardCreationBot] Failed to initialize WebSocket:", error);
      setConnectionError(error?.message || "Failed to connect to AI assistant");
      setIsConnecting(false);
      toast.error(error?.message || "Failed to connect to AI assistant");
      return null;
    }
  };

  const handleStart = async () => {
    if (!projectId) {
      toast.error("Project ID is required to create a dashboard.");
      return;
    }

    setHasStarted(true);
    setIsTyping(true);

    const client = await initWebSocket();
    if (!client) {
      setIsTyping(false);
      return;
    }

    client.dashboardCreation({ project_id: String(projectId) });
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !projectId) return;

    if (!wsClient || !wsClient.isConnected()) {
      toast.error(isConnecting ? "Still connecting to AI assistant..." : "Not connected to AI assistant. Please try again.");
      return;
    }

    const message = userInput.trim();
    addUserMessage(message);
    setUserInput("");
    setIsTyping(true);

    try {
      wsClient.dashboardCreation({
        project_id: String(projectId),
        user_response: message,
      });
    } catch (error: any) {
      console.error("[DashboardCreationBot] Failed to send message:", error);
      setIsTyping(false);
      toast.error(error?.message || "Failed to send your response. Please try again.");
    }
  };

  const handleRetryConnection = () => {
    setConnectionError(null);
    setHasStarted(false);
    setIsTyping(false);
    if (wsClient) {
      wsClient.disconnect();
      setWsClient(null);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const placeholder = currentQuestion
    ? "Type your answer..."
    : "Provide your response";

  return (
    <Card className="border border-border shadow-xl overflow-hidden">
      <div className="flex flex-col h-[600px]">
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground">Dashboard Assistant</h3>
              <p className="text-xs text-muted-foreground">
                {isCompleted
                  ? "Dashboard details captured"
                  : hasStarted
                  ? currentQuestion
                    ? `Question ${Math.max(questionsAsked, 1)} of up to 5`
                    : isTyping
                    ? "Thinking..."
                    : "Waiting for your response"
                  : isConnecting
                  ? "Connecting to AI assistant..."
                  : "Ready to create your dashboard"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-muted/20">
          {connectionError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {connectionError}
              <Button
                variant="link"
                className="pl-2 text-destructive underline"
                onClick={handleRetryConnection}
              >
                Retry
              </Button>
            </div>
          )}

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
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    message.type === "bot"
                      ? "bg-card border border-border text-foreground"
                      : "bg-gradient-to-r from-primary to-accent text-white"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
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

          <div ref={messagesEndRef} />
        </div>

        <div className="px-6 py-4 border-t border-border bg-card">
          {!hasStarted ? (
            <Button
              onClick={handleStart}
              disabled={isConnecting || !projectId}
              className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Let's Create a Dashboard
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-3">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={placeholder}
                className="flex-1 h-12"
                disabled={isTyping || isCompleted || !!connectionError}
                autoFocus
              />
              <Button
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isTyping || isCompleted || !!connectionError}
                className="h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
