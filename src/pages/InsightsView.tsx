import { Lightbulb, TrendingUp, TrendingDown, AlertCircle, Plus, Filter, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

const mockInsights = [
  {
    id: 1,
    title: "Revenue Spike Detected",
    description: "Revenue increased by 34% in the last week, driven primarily by enterprise customers. This is 15% above the normal growth rate.",
    type: "positive",
    category: "Revenue",
    timestamp: "2 hours ago",
    impact: "High"
  },
  {
    id: 2,
    title: "Customer Churn Rate Increasing",
    description: "Monthly churn rate has risen to 5.2%, up from the average of 3.8%. Primary reason cited in exit surveys is pricing concerns.",
    type: "negative",
    category: "Retention",
    timestamp: "5 hours ago",
    impact: "High"
  },
  {
    id: 3,
    title: "New Market Opportunity",
    description: "Analysis shows 23% of traffic comes from Southeast Asia, but only 8% convert. Localization could unlock significant growth.",
    type: "opportunity",
    category: "Growth",
    timestamp: "1 day ago",
    impact: "Medium"
  },
  {
    id: 4,
    title: "Product Feature Adoption",
    description: "The new analytics dashboard has 78% adoption rate among premium users, exceeding the 50% target by a significant margin.",
    type: "positive",
    category: "Product",
    timestamp: "1 day ago",
    impact: "Medium"
  },
  {
    id: 5,
    title: "Marketing Campaign Performance",
    description: "Email campaign ROI dropped to 2.1x from usual 3.5x. Subject line A/B testing suggests personalization issues.",
    type: "negative",
    category: "Marketing",
    timestamp: "2 days ago",
    impact: "Low"
  },
  {
    id: 6,
    title: "Sales Velocity Improving",
    description: "Average sales cycle decreased from 45 to 38 days. Implementation of automated follow-ups showing strong results.",
    type: "positive",
    category: "Sales",
    timestamp: "2 days ago",
    impact: "Medium"
  }
];

export function InsightsView() {
  return (
    <div className="px-12 py-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl text-foreground mb-1">AI Insights</h2>
            <p className="text-muted-foreground">Automatic discoveries and anomalies detected in your data</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Insights
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Lightbulb className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl text-foreground mb-1">24</p>
                  <p className="text-sm text-muted-foreground">Total Insights</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl text-foreground mb-1">8</p>
                  <p className="text-sm text-muted-foreground">Positive Trends</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl text-foreground mb-1">3</p>
                  <p className="text-sm text-muted-foreground">Requires Attention</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl text-foreground mb-1">5</p>
                  <p className="text-sm text-muted-foreground">Anomalies Detected</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Filter Tabs */}
          <Tabs defaultValue="all" className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All Insights</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
              <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Insights Grid */}
          <div className="space-y-4">
            {mockInsights.map((insight) => {
              const iconColor = 
                insight.type === 'positive' ? 'text-success' :
                insight.type === 'negative' ? 'text-destructive' :
                'text-accent';
              
              const iconBg = 
                insight.type === 'positive' ? 'bg-success/10' :
                insight.type === 'negative' ? 'bg-destructive/10' :
                'bg-accent/10';

              const Icon = 
                insight.type === 'positive' ? TrendingUp :
                insight.type === 'negative' ? TrendingDown :
                Lightbulb;

              return (
                <Card 
                  key={insight.id}
                  className="p-6 border border-border hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg text-foreground mb-2">{insight.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {insight.description}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="ml-4 flex-shrink-0">
                          Add to Dashboard
                        </Button>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant="outline" className="border-border">
                          {insight.category}
                        </Badge>
                        <Badge 
                          className={
                            insight.impact === 'High' 
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : insight.impact === 'Medium'
                              ? 'bg-chart-2/10 text-chart-2 border-chart-2/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }
                        >
                          {insight.impact} Impact
                        </Badge>
                        <span className="text-muted-foreground">{insight.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

        {/* Empty State */}
        {mockInsights.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg text-foreground mb-2">No insights yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Ask VizAI to discover patterns in your data</p>
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white">
              Ask VizAI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
