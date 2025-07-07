import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck } from "lucide-react";

interface UserLoginModalProps {
  isOpen: boolean;
  onLogin: (customerId: string) => void;
}

export function UserLoginModal({ isOpen, onLogin }: UserLoginModalProps) {
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId.trim()) {
      setError("Please enter a customer ID");
      return;
    }
    onLogin(customerId.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <UserCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-xl">User Verification</CardTitle>
          <CardDescription>
            Enter your customer ID to access the voice chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Customer ID</Label>
              <Input
                id="customerId"
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Enter your customer ID"
                className="w-full"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <Button type="submit" className="w-full">
              Verify & Login
            </Button>
          </form>
          <div className="mt-4 text-sm text-gray-600">
            <p className="font-medium">Demo Customer IDs:</p>
            <ul className="mt-2 space-y-1">
              <li>• CUST001 - John Doe</li>
              <li>• CUST002 - Sarah Miller</li>
              <li>• CUST003 - Michael Johnson</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
