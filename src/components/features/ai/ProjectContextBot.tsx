import React, { useState, useRef, useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Card } from "../../ui/card";
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


interface ProjectContextBotProps {
  onComplete: (data: {
    name: string;
    description: string;
    context: Record<string, string>;
    enhancedDescription?: string;
    domain?: string;
  }) => void;
  onCancel?: () => void;
  userId?: string; // Optional user ID, will be fetched if not provided
}

export function ProjectContextBot({ onComplete, onCancel, userId }: ProjectContextBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "Hi! 👋 I'm your VizAI assistant. I'll help you set up your analytics project through a quick conversation. Ready to get started?",
      timestamp: new Date()
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [projectState, setProjectState] = useState<any>(null);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Initialize WebSocket connection (lazy - only when user clicks start)
  const initWebSocket = async (): Promise<VizAIWebSocket | null> => {
    try {
      // Get user ID if not provided
      let currentUserId = userId;
      if (!currentUserId) {
        const userResponse = await getCurrentUser();
        if (!userResponse.success || !userResponse.data) {
          console.error('[ProjectContextBot] Failed to get user information');
          return null;
        }
        currentUserId = userResponse.data.id;
      }

      setIsConnecting(true);
      const client = new VizAIWebSocket(currentUserId);
      let connectionEstablished = false;

      // Set up all handlers BEFORE connecting
      
      // Handle project_info responses
      client.on('project_info', (response: WebSocketResponse) => {
        console.log('[ProjectContextBot] Received response:', response);

        if (response.status === 'collecting') {
          // Show question to user
          const question = response.message;
          setCurrentQuestion(question);
          setQuestionsAsked(response.state?.questions_asked_count || 0);
          setProjectState(response.state || {});
          
          // Add bot message with question
          addBotMessage(question);
        } else if (response.status === 'completed') {
          // Project info collection complete
          const state = response.state || {};
          setProjectState(state);
          
          addBotMessage("Thank you for answering all questions! Enhanced description generated.");
          
          setTimeout(() => {
            addBotMessage("Perfect! I have everything I need. Let's set up your database connection next. 🚀");
          }, 1500);

          setTimeout(() => {
            // Complete with enhanced description
            onComplete({
              name: state.name || responses.project_name || "My Project",
              description: state.description || responses.project_description || "",
              enhancedDescription: state.enhanced_description || state.description,
              domain: state.domain || responses.domain || "",
              context: {
                ...responses,
                enhanced_description: state.enhanced_description,
                domain: state.domain,
              }
            });
          }, 3500);
        } else if (response.status === 'error') {
          // Handle error
          console.error('[ProjectContextBot] Error:', response.error);
          toast.error(response.error || response.message || "An error occurred");
          setIsTyping(false);
          addBotMessage("I'm sorry, something went wrong. Please try again.");
        }
      });

      // Handle connection open
      client.onOpen(() => {
        console.log('[ProjectContextBot] WebSocket connection established');
        connectionEstablished = true;
      });

      // Handle connection errors
      client.onError((error) => {
        console.error('[ProjectContextBot] WebSocket error:', error);
        if (!connectionEstablished) {
          setConnectionError("Failed to connect to AI assistant. Please check your connection and try again.");
          setIsConnecting(false);
          setIsTyping(false);
        }
      });

      // Handle connection close
      client.onClose(() => {
        if (connectionEstablished && !client.isConnected()) {
          // Connection was established but closed unexpectedly
          setConnectionError("Connection lost. Please try again.");
          setIsTyping(false);
        } else if (!connectionEstablished) {
          // Connection failed before being established
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
            setTimeout(() => reject(new Error('Connection timeout')), 10000); // 10 second timeout
          })
        ]);
        
        // Wait a bit to ensure connection is fully established
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (client.isConnected()) {
          setWsClient(client);
          setIsConnecting(false);
          return client;
        } else {
          throw new Error('Connection not established');
        }
      } catch (error: any) {
        console.warn('[ProjectContextBot] WebSocket connection failed:', error.message);
        setConnectionError(error.message || "Connection timeout. Please ensure the WebSocket server is running.");
        setIsConnecting(false);
        return null;
      }
    } catch (error: any) {
      console.error('[ProjectContextBot] Failed to initialize WebSocket:', error);
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
      // Start project_info workflow with initial empty payload
      // The server will ask the first question
      client.projectInfo({});
    } else {
      // WebSocket connection failed
      setConnectionError("Unable to connect to AI assistant. Please check that the WebSocket server is running and try again.");
      setIsConnecting(false);
      setIsTyping(false);
    }
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) {
      return;
    }

    if (!wsClient || !wsClient.isConnected()) {
      toast.error("Not connected to AI assistant. Please wait for connection or try again.");
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: userInput,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMessage]);

    // Store response for reference
    const inputValue = userInput;
    setUserInput("");
    setIsTyping(true);

    // Update responses state
    setResponses((prev) => ({
      ...prev,
      [`response_${Date.now()}`]: inputValue
    }));

    // Send user response via WebSocket
    wsClient.projectInfo({
      user_response: inputValue
    });
  };

  const handleKeyPress = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
              <p className="text-xs text-muted-foreground">
                {hasStarted 
                  ? questionsAsked > 0
                    ? `Question ${questionsAsked} of up to 5` 
                    : connectionError
                    ? "Connection error"
                    : "Starting conversation..."
                  : isConnecting 
                    ? "Connecting to AI assistant..." 
                    : "Ready to help you get started"}
              </p>
            </div>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            )}
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
                  setMessages([{
                    id: 1,
                    type: "bot",
                    content: "Hi! 👋 I'm your VizAI assistant. I'll help you set up your analytics project through a quick conversation. Ready to get started?",
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
            <div className="space-y-2">
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
                    Let's Get Started
                  </>
                )}
              </Button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </Card>
  );
}
