import React, { useState, useRef, useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Card } from "../../ui/card";
import { Avatar } from "../../ui/avatar";
import { VizAIWebSocket, WebSocketResponse } from "../../../services/websocket";
import { toast } from "sonner";

interface Message {
  id: number;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
}

interface KPIInfoBotProps {
  onComplete: (data: {
    kpis: string[];
    kpisSummary: string;
  }) => void;
  onCancel?: () => void;
  userId: string;
  projectName?: string;
  projectDescription?: string;
  projectDomain?: string;
  productDescription?: string; // Enhanced description from project_info
}

export function KPIInfoBot({ 
  onComplete, 
  onCancel, 
  userId,
  projectName,
  projectDescription,
  projectDomain,
  productDescription
}: KPIInfoBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "Great! Now let's identify the key metrics (KPIs) you want to track for this project. I'll ask you a few questions to understand your priorities.",
      timestamp: new Date()
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [probableAnswers, setProbableAnswers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Auto-focus input when component mounts, when typing stops, or when a new question arrives
  useEffect(() => {
    if (hasStarted && !isTyping && currentQuestion && inputRef.current) {
      // Use multiple attempts to ensure focus
      const focusInput = () => {
        if (inputRef.current && !inputRef.current.disabled) {
          inputRef.current.focus();
        }
      };
      
      const timer1 = setTimeout(focusInput, 50);
      const timer2 = setTimeout(focusInput, 200);
      const timer3 = setTimeout(focusInput, 500);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [hasStarted, isTyping, currentQuestion]);

  // Initialize WebSocket connection
  useEffect(() => {
    const initWebSocket = async () => {
      try {
        setIsConnecting(true);
        const client = new VizAIWebSocket(userId);

        // Handle kpi_info responses
        client.on('kpi_info', (response: WebSocketResponse) => {
          console.log('[KPIInfoBot] Received response:', response);

          if (response.status === 'collecting') {
            // Show question to user
            const question = response.message;
            setCurrentQuestion(question);
            setQuestionsAsked(response.state?.questions_asked_count || 0);
            setProbableAnswers(response.probable_answers || []);
            
            // Add bot message with question
            addBotMessage(question);
            
            // Focus input after question is set
            setTimeout(() => {
              if (inputRef.current && !inputRef.current.disabled) {
                inputRef.current.focus();
              }
            }, 900);
          } else if (response.status === 'completed') {
            // KPI collection complete
            const state = response.state || {};
            const kpis = state.kpis || [];
            const kpisSummary = state.kpis_summary || "";
            setProbableAnswers([]);
            
            addBotMessage("Perfect! I've collected your KPIs. Thank you!");
            
            setTimeout(() => {
              // Complete with KPIs
              onComplete({
                kpis: Array.isArray(kpis) ? kpis : [],
                kpisSummary: kpisSummary
              });
            }, 1500);
          } else if (response.status === 'error') {
            // Handle error
            console.error('[KPIInfoBot] Error:', response.error);
            toast.error(response.error || response.message || "An error occurred");
            setIsTyping(false);
            setProbableAnswers([]);
            addBotMessage("I'm sorry, something went wrong. Please try again.");
          }
        });

        // Handle connection errors
        client.onError((error) => {
          console.error('[KPIInfoBot] WebSocket error:', error);
          toast.error("Connection error. Please try again.");
          setIsConnecting(false);
        });

        // Connect WebSocket
        await client.connect();
        setWsClient(client);
        setIsConnecting(false);
        setHasStarted(true);

        // Start kpi_info workflow with project context
        setTimeout(() => {
          client.kpiInfo({
            project_name: projectName,
            project_description: projectDescription,
            project_domain: projectDomain,
            product_description: productDescription // Has priority
          });
        }, 500);
      } catch (error: any) {
        console.error('[KPIInfoBot] Failed to initialize WebSocket:', error);
        toast.error("Failed to connect. Please try again.");
        setIsConnecting(false);
      }
    };

    if (userId) {
      initWebSocket();
    }

    // Cleanup on unmount
    return () => {
      if (wsClient) {
        wsClient.disconnect();
      }
    };
  }, [userId, projectName, projectDescription, projectDomain, productDescription]);

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
      // Focus input after bot message is added
      setTimeout(() => {
        if (inputRef.current && !inputRef.current.disabled) {
          inputRef.current.focus();
        }
      }, 100);
    }, 800);
  };

  const sendResponse = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return;
    }

    if (!wsClient || !wsClient.isConnected()) {
      toast.error("Please wait for connection...");
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
    setProbableAnswers([]);

    wsClient.kpiInfo({
      user_response: trimmed
    });

    // Refocus input after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
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
    // Refocus input after selecting suggested answer
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

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
              <h3 className="text-foreground">KPI Collection</h3>
              <p className="text-xs text-muted-foreground">
                {hasStarted 
                  ? questionsAsked > 0 
                    ? `Question ${questionsAsked} of up to 5` 
                    : "Starting conversation..."
                  : isConnecting 
                    ? "Connecting..." 
                    : "Ready to collect KPIs"}
              </p>
            </div>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip
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

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-border bg-card">
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
                  disabled={!wsClient || !wsClient.isConnected() || isTyping || isConnecting}
                >
                  {answer}
                </Button>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <Input
              ref={(el) => {
                inputRef.current = el;
                // Focus immediately when ref is set and element is available
                if (el && !el.disabled) {
                  setTimeout(() => {
                    if (el && !el.disabled) {
                      el.focus();
                    }
                  }, 0);
                }
              }}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your answer..."
              className="flex-1 h-12"
              disabled={isTyping || !currentQuestion || !wsClient || !wsClient.isConnected() || isConnecting}
              autoFocus
            />
            <Button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isTyping || !currentQuestion || !wsClient || !wsClient.isConnected() || isConnecting}
              className="h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white disabled:opacity-50"
            >
              {isTyping ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

