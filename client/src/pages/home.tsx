import { Link } from "wouter";
import { Headphones, User, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-primary/10 to-white px-4 py-16 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Headphones className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Voice Chat Application
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mb-12">
          Connect with your customers through high-quality voice calls. Simple, fast, and reliable.
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/admin">
            <Button className="gap-2 h-12 px-8 text-lg" size="lg">
              <UserCog className="h-5 w-5" />
              Admin Panel
            </Button>
          </Link>
          <Link href="/user">
            <Button variant="outline" className="gap-2 h-12 px-8 text-lg" size="lg">
              <User className="h-5 w-5" />
              User Panel
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 bg-white border-t">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} Voice Bridge. All rights reserved.
        </div>
      </footer>
    </div>
  );
}