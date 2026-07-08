import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogin } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  
  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.user, data.token);
        toast.success("Login successful");
        if (data.user.role === "ADMIN") setLocation("/dashboard");
        else if (data.user.role === "WAITER") setLocation("/tables");
        else if (data.user.role === "CASHIER") setLocation("/pos");
        else if (data.user.role === "COCINERA") setLocation("/kitchen");
        else setLocation("/tables");
      },
      onError: (error) => {
        toast.error("Login failed: " + error.message);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { name, password } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
      
      <Card className="w-full max-w-md relative z-10 border-primary/20 shadow-2xl">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 flex items-center justify-center rounded-full mb-2">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">La Playita</CardTitle>
          <CardDescription>Don Concho POS System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Username</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                className="bg-card"
                placeholder="Enter your username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="bg-card"
                placeholder="••••••••"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Connecting..." : "Enter System"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
