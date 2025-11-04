import { useState } from "react";
import { User, Lock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { toast } from "sonner@2.0.3";
import { login } from "../services/api";

type UserRole = 'super_admin' | 'project_user';

interface AuthViewProps {
  onAuthenticated: (user: { name: string; email: string; role: UserRole }) => void;
}

export function AuthView({ onAuthenticated }: AuthViewProps) {
  // Login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("project_user");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginUsername || !loginPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const result = await login({
        username: loginUsername,
        password: loginPassword,
      });

      if (result.success && result.data) {
        toast.success(`Welcome back${userRole === 'super_admin' ? ', Admin' : ''}!`);
        onAuthenticated({
          name: result.data.user.name || result.data.user.username,
          email: result.data.user.email,
          role: userRole,
        });
      } else {
        toast.error(result.error?.message || "Login failed. Please check your credentials.");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background to-background-secondary flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 relative z-10">
        {/* Left side - Branding */}
        <div className="hidden md:flex flex-col justify-center space-y-8 p-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl text-foreground">VizAI</h1>
            </div>
            
            <h2 className="text-4xl text-foreground leading-tight">
              Transform Your Data
              <br />
              Into Insights
            </h2>
            <p className="text-lg text-muted-foreground">
              Connect to your databases, ask questions in natural language, 
              and visualize insights with AI-powered analytics.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <div>
                <h3 className="text-foreground mb-1">AI-Powered Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Ask questions in natural language and get instant visualizations
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-accent" />
              </div>
              <div>
                <h3 className="text-foreground mb-1">Multi-Database Support</h3>
                <p className="text-sm text-muted-foreground">
                  Connect to PostgreSQL and MySQL databases seamlessly
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-secondary" />
              </div>
              <div>
                <h3 className="text-foreground mb-1">Team Collaboration</h3>
                <p className="text-sm text-muted-foreground">
                  Share dashboards and insights with your entire team
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth Forms */}
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md border border-border shadow-2xl">
            <div className="p-8">
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl text-foreground mb-1">Welcome Back</h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to continue to VizAI
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Login As</Label>
                  <RadioGroup value={userRole} onValueChange={(value) => setUserRole(value as UserRole)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="project_user" id="project_user" />
                      <Label htmlFor="project_user" className="cursor-pointer">
                        Project User
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="super_admin" id="super_admin" />
                      <Label htmlFor="super_admin" className="cursor-pointer">
                        Super Admin
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="johndoe"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="pl-10"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm cursor-pointer"
                    >
                      Remember me
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-sm text-muted-foreground hover:text-primary"
                  >
                    Forgot password?
                  </Button>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                  {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
