import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, Database, Check, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Card } from "../../ui/card";
import { Avatar } from "../../ui/avatar";
import { Checkbox } from "../../ui/checkbox";
import { Badge } from "../../ui/badge";

interface Message {
  id: number;
  type: "bot" | "user" | "database-selector" | "generating";
  content: string;
  timestamp: Date;
}

interface Database {
  id: number;
  name: string;
  type: string;
  status: string;
}

// Mock databases - in real app this would come from props
const mockDatabases: Database[] = [
  { id: 1, name: "Production DB", type: "PostgreSQL", status: "Connected" },
  { id: 2, name: "Analytics DB", type: "MySQL", status: "Connected" },
  { id: 3, name: "Staging DB", type: "PostgreSQL", status: "Connected" },
  { id: 4, name: "Customer Data", type: "MySQL", status: "Connected" },
];

interface DashboardCreationBotProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export function DashboardCreationBot({ isOpen, onClose, onCreate }: DashboardCreationBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "Hi! 👋 I'm your VizAI assistant. I'll help you create a new dashboard through a quick conversation. Let's get started!",
      timestamp: new Date()
    }
  ]);
  const [currentStep, setCurrentStep] = useState(0); // 0: name, 1: description, 2: databases, 3: prompt
  const [userInput, setUserInput] = useState("");
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [selectedDatabases, setSelectedDatabases] = useState<number[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showDatabaseSelector, setShowDatabaseSelector] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingDatabases, setIsProcessingDatabases] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setMessages([
        {
          id: 1,
          type: "bot",
          content: "Hi! 👋 I'm your VizAI assistant. I'll help you create a new dashboard through a quick conversation. Let's get started!",
          timestamp: new Date()
        }
      ]);
      setCurrentStep(0);
      setUserInput("");
      setDashboardName("");
      setDashboardDescription("");
      setSelectedDatabases([]);
      setPrompt("");
      setIsTyping(false);
      setHasStarted(false);
      setShowDatabaseSelector(false);
      setIsGenerating(false);
      setIsProcessingDatabases(false);
    }
  }, [isOpen]);

  const addBotMessage = (content: string, type: "bot" | "database-selector" | "generating" = "bot") => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          type,
          content,
          timestamp: new Date()
        }
      ]);
      setIsTyping(false);
      if (type === "database-selector") {
        setShowDatabaseSelector(true);
      }
    }, 800);
  };

  const handleStart = () => {
    setHasStarted(true);
    addBotMessage("Great! Let's start by naming your dashboard. What would you like to call it?");
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: userInput,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMessage]);

    const input = userInput;
    setUserInput("");

    // Process based on current step
    if (currentStep === 0) {
      // Dashboard name
      setDashboardName(input);
      setTimeout(() => {
        addBotMessage(`"${input}" - I like it! 👍`);
      }, 1000);
      setTimeout(() => {
        addBotMessage("Now, can you describe what this dashboard is about? (This is optional, but helps us understand your needs)");
        setCurrentStep(1);
      }, 2500);
    } else if (currentStep === 1) {
      // Dashboard description
      setDashboardDescription(input);
      setTimeout(() => {
        addBotMessage("Perfect! Now let's connect this dashboard to your data sources.");
      }, 1000);
      setTimeout(() => {
        addBotMessage("Select which databases this dashboard will use:", "database-selector");
        setCurrentStep(2);
      }, 2500);
    } else if (currentStep === 3) {
      // AI Prompt
      setPrompt(input);
      setTimeout(() => {
        addBotMessage("Excellent! I have everything I need. Let me generate some charts for you...", "generating");
        setIsGenerating(true);
      }, 1000);
      
      // Simulate generation and trigger dashboard creation
      setTimeout(() => {
        setIsGenerating(false);
        onCreate(dashboardName, dashboardDescription);
      }, 3500);
    }
  };

  const handleDatabaseSelection = () => {
    if (selectedDatabases.length === 0 || isProcessingDatabases) return;

    setIsProcessingDatabases(true);
    setShowDatabaseSelector(false);
    
    const selectedDbNames = mockDatabases
      .filter(db => selectedDatabases.includes(db.id))
      .map(db => db.name)
      .join(", ");

    // Add a message showing selected databases
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        type: "user",
        content: `Selected: ${selectedDbNames}`,
        timestamp: new Date()
      }
    ]);

    setTimeout(() => {
      addBotMessage("Great choices! 🎯");
    }, 1000);
    
    setTimeout(() => {
      addBotMessage("Now, describe what insights and charts you want to see in this dashboard. Be as specific as you like!");
      setCurrentStep(3);
      setIsProcessingDatabases(false);
    }, 2500);
  };

  const toggleDatabase = (id: number) => {
    setSelectedDatabases(prev => 
      prev.includes(id) 
        ? prev.filter(dbId => dbId !== id)
        : [...prev, id]
    );
  };

  const handleKeyPress = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getPlaceholder = () => {
    if (!hasStarted) return "Type your answer...";
    switch (currentStep) {
      case 0:
        return "e.g., Revenue Overview, Sales Analytics";
      case 1:
        return "e.g., Track monthly sales and customer metrics";
      case 3:
        return "e.g., Show monthly revenue trends, top products, regional performance...";
      default:
        return "Type your answer...";
    }
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
              <h3 className="text-foreground">VizAI Assistant</h3>
              <p className="text-xs text-muted-foreground">
                {hasStarted 
                  ? `Step ${currentStep + 1} of 4` 
                  : "Ready to create your dashboard"}
              </p>
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
                {message.type !== "user" && (
                  <Avatar className="w-8 h-8 bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </Avatar>
                )}
                
                {message.type === "database-selector" ? (
                  <div className="max-w-[85%] bg-card border border-border rounded-2xl p-4">
                    <p className="text-sm text-foreground mb-4">{message.content}</p>
                    <div className="space-y-2 mb-4">
                      {mockDatabases.map((db) => (
                        <div
                          key={db.id}
                          onClick={() => toggleDatabase(db.id)}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedDatabases.includes(db.id)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-accent/5"
                          }`}
                        >
                          <Checkbox
                            checked={selectedDatabases.includes(db.id)}
                            onCheckedChange={() => toggleDatabase(db.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Database className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <span className="text-sm font-medium text-foreground">{db.name}</span>
                              <Badge variant="outline" className="ml-auto text-xs">
                                {db.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {db.status}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedDatabases.length > 0 && showDatabaseSelector && (
                      <Button
                        onClick={handleDatabaseSelection}
                        disabled={isProcessingDatabases}
                        className="w-full bg-gradient-to-r from-primary to-accent text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessingDatabases ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Continue with {selectedDatabases.length} database{selectedDatabases.length > 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : message.type === "generating" ? (
                  <div className="max-w-[70%] bg-card border border-primary/20 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <p className="text-sm text-foreground">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.type === "bot"
                        ? "bg-card border border-border text-foreground"
                        : "bg-gradient-to-r from-primary to-accent text-white"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                )}
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
          {!hasStarted ? (
            <Button
              onClick={handleStart}
              className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Let's Create a Dashboard
            </Button>
          ) : (
            <div className="flex gap-3">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={getPlaceholder()}
                className="flex-1 h-12"
                disabled={isTyping || showDatabaseSelector || isGenerating}
                autoFocus
              />
              <Button
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isTyping || showDatabaseSelector || isGenerating}
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
