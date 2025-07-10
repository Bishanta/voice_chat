import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Headphones, UserCog, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import AdminPage from "@/pages/admin";
import UserPage from "@/pages/user";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";

function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Headphones className="h-8 w-8 text-primary mr-3" />
            <h1 className="text-xl font-semibold text-gray-900">Voice Chat App</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button
                variant={location === "/admin" ? "default" : "ghost"}
                className="flex items-center space-x-2"
              >
                <UserCog className="h-4 w-4" />
                <span>Admin Panel</span>
              </Button>
            </Link>
            <Link href="/user">
              <Button
                variant={location === "/user" ? "default" : "ghost"}
                className="flex items-center space-x-2"
              >
                <User className="h-4 w-4" />
                <span>User Panel</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={AdminPage} />
      <Route path="/user" component={UserPage} />
      <Route path="/" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main>
            <Router />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
