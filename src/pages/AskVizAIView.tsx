import { useState } from "react";
import { Sparkles, Send, TrendingUp, Calendar, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const mockChartData = [
  { month: 'Jan', revenue: 45000, customers: 120 },
  { month: 'Feb', revenue: 52000, customers: 145 },
  { month: 'Mar', revenue: 48000, customers: 132 },
  { month: 'Apr', revenue: 61000, customers: 178 },
  { month: 'May', revenue: 55000, customers: 165 },
  { month: 'Jun', revenue: 67000, customers: 195 },
];

const suggestedQuestions = [
  "What was our revenue growth last quarter?",
  "Show me customer acquisition trends",
  "Compare sales performance by region",
  "Which products have highest margins?",
];

export function AskVizAIView() {
  const [query, setQuery] = useState("");
  const [hasResults, setHasResults] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSubmit = () => {
    if (!query.trim()) return;
    
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setHasResults(true);
    }, 1500);
  };

  return (
    <div className="px-12 py-10">
      {!hasResults ? (
        // Initial State
        <div className="min-h-[600px] flex flex-col items-center justify-center">
          <div className="max-w-3xl w-full">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl glow">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl text-center text-foreground mb-3">
              Ask VizAI
            </h1>
            <p className="text-center text-muted-foreground mb-10 text-lg">
              Ask questions about your data in natural language
            </p>

            {/* Search Box */}
            <Card className="p-2 border-2 border-border shadow-lg">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="Ask VizAI about your data..."
                  className="flex-1 px-4 py-4 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground"
                />
                <Button 
                  onClick={handleSubmit}
                  disabled={!query.trim() || isAnalyzing}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white px-6"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Ask
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Suggested Questions */}
            <div className="mt-8">
              <p className="text-sm text-muted-foreground mb-4 text-center">Try asking:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(question)}
                    className="p-4 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-all text-left text-sm text-foreground"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Results State
        <div className="max-w-[1600px] mx-auto">
            {/* Query Header */}
            <Card className="p-6 mb-8 border border-border card-gradient">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm mb-2">Your question:</p>
                  <p className="text-lg text-foreground">{query || "What was our revenue growth last quarter?"}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setHasResults(false);
                    setQuery("");
                  }}
                >
                  New Question
                </Button>
              </div>
            </Card>

            {/* Results Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Visualization */}
              <Card className="p-6 border border-border">
                <h3 className="text-lg text-foreground mb-6">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#06B6D4" 
                      strokeWidth={3}
                      dot={{ fill: '#06B6D4', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* AI Insights */}
              <Card className="p-6 border border-border">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h3 className="text-lg text-foreground">AI Insights</h3>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-5 h-5 text-success" />
                      <h4 className="text-foreground">Revenue Growth</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your revenue grew <span className="text-success font-medium">22.4%</span> quarter-over-quarter, 
                      from $145,000 in Q1 to $177,000 in Q2. This represents the strongest growth rate in the past year.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5 text-accent" />
                      <h4 className="text-foreground">Customer Acquisition</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      New customer signups increased by <span className="text-accent font-medium">18.5%</span>, 
                      with June showing the highest conversion rate at 195 new customers.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-5 h-5 text-chart-2" />
                      <h4 className="text-foreground">Seasonal Pattern</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Analysis shows consistent month-over-month growth with a notable peak in June, 
                      suggesting effective seasonal marketing campaigns.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Follow-up Suggestions */}
            <div className="mt-8">
              <p className="text-sm text-muted-foreground mb-4">Explore further:</p>
              <div className="flex gap-3 flex-wrap">
                <Badge 
                  className="px-4 py-2 cursor-pointer hover:bg-accent hover:text-white transition-colors"
                  variant="outline"
                >
                  Group by region
                </Badge>
                <Badge 
                  className="px-4 py-2 cursor-pointer hover:bg-accent hover:text-white transition-colors"
                  variant="outline"
                >
                  Compare to previous quarter
                </Badge>
                <Badge 
                  className="px-4 py-2 cursor-pointer hover:bg-accent hover:text-white transition-colors"
                  variant="outline"
                >
                  Show by product category
                </Badge>
                <Badge 
                  className="px-4 py-2 cursor-pointer hover:bg-accent hover:text-white transition-colors"
                  variant="outline"
                >
                  Forecast next quarter
                </Badge>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
