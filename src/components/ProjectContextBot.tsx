import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Avatar } from "./ui/avatar";

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

const QUESTIONS: Question[] = [
  {
    id: "project_name",
    question: "Let's start by naming your analytics project. What would you like to call it?",
    followUp: "Great name! Let's continue.",
    placeholder: "e.g., E-Commerce Analytics"
  },
  {
    id: "project_description",
    question: "Perfect! Can you describe what this project is about? This helps us understand your needs better.",
    followUp: "Excellent! Now I have a few quick questions to personalize your experience.",
    placeholder: "e.g., Track sales performance and customer behavior..."
  },
  {
    id: "industry",
    question: "What industry or domain is this project focused on?",
    followUp: "Great! That helps us understand your data context.",
    placeholder: "e.g., Retail, Finance, Healthcare"
  },
  {
    id: "goal",
    question: "What's your primary goal with this analytics project?",
    followUp: "Perfect! We'll help you track those metrics.",
    placeholder: "e.g., Improve customer retention"
  },
  {
    id: "team_size",
    question: "How many people will be using this workspace?",
    followUp: "Got it! We'll set up the right collaboration features.",
    placeholder: "e.g., 5-10 people"
  },
  {
    id: "data_sources",
    question: "What types of data sources will you be connecting? (e.g., sales data, user analytics, financial records)",
    followUp: "Excellent! We'll prepare the right connectors for you.",
    placeholder: "e.g., Sales database, Google Analytics"
  }
];

interface ProjectContextBotProps {
  onComplete: (data: {
    name: string;
    description: string;
    context: Record<string, string>;
  }) => void;
  onCancel?: () => void;
}

export function ProjectContextBot({ onComplete, onCancel }: ProjectContextBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "Hi! 👋 I'm your VizAI assistant. I'll help you set up your analytics project through a quick conversation. Ready to get started?",
      timestamp: new Date()
    }
  ]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
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
    addBotMessage(QUESTIONS[0].question);
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
    const currentQuestion = QUESTIONS[currentQuestionIndex];
    const newResponses = {
      ...responses,
      [currentQuestion.id]: userInput
    };
    setResponses(newResponses);

    setUserInput("");

    // Check if there are more questions
    if (currentQuestionIndex < QUESTIONS.length - 1) {
      // Add follow-up message
      if (currentQuestion.followUp) {
        setTimeout(() => {
          addBotMessage(currentQuestion.followUp!);
        }, 1000);
      }

      // Ask next question
      setTimeout(() => {
        addBotMessage(QUESTIONS[currentQuestionIndex + 1].question);
        setCurrentQuestionIndex((prev) => prev + 1);
      }, currentQuestion.followUp ? 2500 : 1500);
    } else {
      // All questions answered
      setTimeout(() => {
        addBotMessage(currentQuestion.followUp || "Thank you!");
      }, 1000);
      
      setTimeout(() => {
        addBotMessage("Perfect! I have everything I need. Let's set up your database connection next. 🚀");
      }, 2500);

      setTimeout(() => {
        // Extract project name and description from responses
        const projectName = newResponses.project_name || "My Project";
        const projectDescription = newResponses.project_description || "";
        
        // Remove project_name and project_description from context
        const { project_name, project_description, ...context } = newResponses;
        
        onComplete({
          name: projectName,
          description: projectDescription,
          context
        });
      }, 4500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentPlaceholder = hasStarted && currentQuestionIndex < QUESTIONS.length 
    ? QUESTIONS[currentQuestionIndex].placeholder || "Type your answer..."
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
                  ? `Question ${Math.min(currentQuestionIndex + 1, QUESTIONS.length)} of ${QUESTIONS.length}` 
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

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-border bg-card">
          {!hasStarted ? (
            <div className="space-y-2">
              <Button
                onClick={handleStart}
                className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Let's Get Started
              </Button>
              <Button
                onClick={() => {
                  onComplete({
                    name: "Test Project",
                    description: "Testing the onboarding flow",
                    context: {
                      industry: "Technology",
                      goal: "Testing",
                      team_size: "1",
                      data_sources: "Test data"
                    }
                  });
                }}
                variant="ghost"
                className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Skip for Testing
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
                disabled={isTyping || currentQuestionIndex >= QUESTIONS.length}
                autoFocus
              />
              <Button
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isTyping || currentQuestionIndex >= QUESTIONS.length}
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
