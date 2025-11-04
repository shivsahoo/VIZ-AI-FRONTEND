import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles, CheckCircle2, LayoutDashboard } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";

interface Message {
  id: number;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
}

interface Question {
  id: string;
  question: string;
  followUp?: string;
  placeholder?: string;
}

const DATABASE_QUESTIONS: Question[] = [
  {
    id: "primary_metrics",
    question: "Now that your database is connected, let's understand your data better! What are the primary metrics or KPIs you want to track? (e.g., revenue, user growth, conversion rates)",
    followUp: "Great! Those are important metrics to monitor.",
    placeholder: "e.g., Monthly revenue, customer acquisition cost, churn rate"
  },
  {
    id: "key_tables",
    question: "Which tables or data entities are most important for your analysis? (e.g., orders, customers, products)",
    followUp: "Perfect! I'll focus on those key tables.",
    placeholder: "e.g., sales, users, transactions"
  },
  {
    id: "time_period",
    question: "What time period is most relevant for your analysis? (e.g., last 30 days, year-to-date, quarterly)",
    followUp: "Got it! I'll use that timeframe for the dashboards.",
    placeholder: "e.g., Last 6 months, Current fiscal year"
  },
  {
    id: "comparison_needs",
    question: "Do you need to compare data across different dimensions? (e.g., regions, product categories, customer segments)",
    followUp: "Excellent! Comparisons will help spot trends and patterns.",
    placeholder: "e.g., By region, by product line, by customer tier"
  },
  {
    id: "insights_needed",
    question: "What specific insights or questions are you hoping to answer with this data?",
    followUp: "Perfect! I understand what you're looking for.",
    placeholder: "e.g., Which products drive most revenue? Where are customers churning?"
  }
];

interface DatabaseContextBotProps {
  databaseName: string;
  onComplete: (context: {
    responses: Record<string, string>;
    suggestedDashboards: Array<{
      name: string;
      description: string;
      charts: string[];
    }>;
  }) => void;
}

export function DatabaseContextBot({ databaseName, onComplete }: DatabaseContextBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: `Perfect! Now that I have access to your selected tables, let me understand what insights you're looking for. This will help me create the most relevant dashboards for you! 🎯`,
      timestamp: new Date()
    }
  ]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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

  const handleStart = () => {
    setHasStarted(true);
    addBotMessage(DATABASE_QUESTIONS[0].question);
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

    // Store response
    const currentQuestion = DATABASE_QUESTIONS[currentQuestionIndex];
    const newResponses = {
      ...responses,
      [currentQuestion.id]: userInput
    };
    setResponses(newResponses);

    setUserInput("");

    // Check if there are more questions
    if (currentQuestionIndex < DATABASE_QUESTIONS.length - 1) {
      // Add follow-up message
      if (currentQuestion.followUp) {
        setTimeout(() => {
          addBotMessage(currentQuestion.followUp!);
        }, 1000);
      }

      // Ask next question
      setTimeout(() => {
        addBotMessage(DATABASE_QUESTIONS[currentQuestionIndex + 1].question);
        setCurrentQuestionIndex((prev) => prev + 1);
      }, currentQuestion.followUp ? 2500 : 1500);
    } else {
      // All questions answered - analyze and suggest dashboards
      setTimeout(() => {
        addBotMessage(currentQuestion.followUp || "Thank you!");
      }, 1000);
      
      setTimeout(() => {
        setIsAnalyzing(true);
        addBotMessage("Analyzing your database schema and understanding your needs... 🔍");
      }, 2500);

      setTimeout(() => {
        addBotMessage("Perfect! I have everything I need. I'm now generating intelligent dashboards based on your data and requirements. Let's get started! 🚀");
      }, 5000);

      setTimeout(() => {
        const suggestedDashboards = generateDashboardSuggestions(newResponses);
        setIsAnalyzing(false);
        onComplete({
          responses: newResponses,
          suggestedDashboards
        });
      }, 6500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentPlaceholder = hasStarted && currentQuestionIndex < DATABASE_QUESTIONS.length 
    ? DATABASE_QUESTIONS[currentQuestionIndex].placeholder || "Type your answer..."
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
                    ? `Question ${Math.min(currentQuestionIndex + 1, DATABASE_QUESTIONS.length)} of ${DATABASE_QUESTIONS.length}` 
                    : "Understanding your database"}
                </p>
                {hasStarted && (
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

          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center py-4"
            >
              <Card className="p-6 border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 max-w-md">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse">
                    <LayoutDashboard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-foreground mb-1">Analyzing Your Database</h4>
                    <p className="text-sm text-muted-foreground">
                      Examining schema, relationships, and data patterns...
                    </p>
                  </div>
                </div>
              </Card>
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
              Let's Understand Your Data
            </Button>
          ) : (
            <div className="flex gap-3">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={currentPlaceholder}
                className="flex-1 h-12"
                disabled={isTyping || currentQuestionIndex >= DATABASE_QUESTIONS.length || isAnalyzing}
                autoFocus
              />
              <Button
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isTyping || currentQuestionIndex >= DATABASE_QUESTIONS.length || isAnalyzing}
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
