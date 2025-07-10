import { useEffect, useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Headphones, Phone, PhoneOff, Mic, MicOff, History } from "lucide-react";
import { UserLoginModal } from "@/components/user-login-modal";
import { CallModal } from "@/components/call-modal";
import { useSocket } from "@/hooks/use-socket";
import { useWebRTC } from "@/hooks/use-webrtc";
import { audioManager } from "@/lib/audio-context";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { toast } from "@/hooks/use-toast";


export default function UserPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "connected">("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callModalType, setCallModalType] = useState<"incoming" | "outgoing" | "active">("incoming");

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'call_initiated':
        handleIncomingCall(message.data);
        break;
      case 'call_accepted':
        handleCallAccepted(message.data);
        break;
      case 'call_declined':
        handleCallDeclined(message.data);
        break;
      case 'call_ended':
        handleCallEnded(message.data);
        break;
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate':
        // These will be handled by the WebRTC hook when it's initialized
        break;
    }
  }, []);

  const { initSocket, sendMessage } = useSocket();

  const { 
    initializeWebRTC,
    isConnected, 
    isMuted, 
    toggleMute, 
    endCall: endWebRTCCall, 
    initializePeerConnection 
  } = useWebRTC();

  const loginMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await apiRequest("POST", "/api/auth/login", { customerId });
      return response.json();
    },
    onSuccess: async (user: User) => {
      setCurrentUser(user);
      setShowLoginModal(false);
      const socket = await initSocket(handleWebSocketMessage, user);
      initializeWebRTC(socket);
    },
    onError: (error) => {
      console.log(error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === "connected") {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);



  const handleIncomingCall = (data: any) => {
    setActiveCall(data);
    setCallState("ringing");
    setCallModalType("incoming");
    setShowCallModal(true);
    audioManager.playRingTone();
  };

  const handleCallAccepted = (data: any) => {
    audioManager.stopRingTone();
    setCallState("connected");
    setCallModalType("active");
    setCallDuration(0);
    initializePeerConnection(data, true);
  };

  const handleCallDeclined = (data: any) => {
    audioManager.stopRingTone();
    setCallState("idle");
    setShowCallModal(false);
    setActiveCall(null);
  };

  const handleCallEnded = (data: any) => {
    audioManager.stopRingTone();
    setCallState("idle");
    setShowCallModal(false);
    setActiveCall(null);
    setCallDuration(0);
    endWebRTCCall();
  };

  const handleLogin = (customerId: string) => {
    loginMutation.mutate(customerId);
  };

  const callAdmin = () => {
    if (!currentUser) return;

    audioManager.resumeAudioContext();
    const callId = `call_${Date.now()}`;
    const callData = {
      callId,
      caller: {
        id: currentUser.customerId,
        name: currentUser.name,
        avatar: currentUser.avatar,
      }
    };

    setActiveCall(callData);
    setCallState("calling");
    setCallModalType("outgoing");
    setShowCallModal(true);
    initializePeerConnection(callData, false);
    sendMessage({
      type: 'call_initiated',
      data: callData,
    });
  };

  const acceptCall = () => {
    if (activeCall) {
      console.log("Accepting call...", activeCall);
      sendMessage({
        type: 'call_accepted',
        data: {
          callId: activeCall.callId,
        },
      });
      handleCallAccepted(activeCall);
    }
  };

  const declineCall = () => {
    if (activeCall) {
      sendMessage({
        type: 'call_declined',
        data: {
          callId: activeCall.callId,
        },
      });
    }
  };

  const endCall = () => {
    if (activeCall) {
      sendMessage({ 
        type: 'call_ended',
        data: {
          callId: activeCall.callId,
        },
      });
    }
    setActiveCall(null);
    setShowCallModal(false);
    setCallState("idle");
    endWebRTCCall();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getAvatarColor = (avatar: string) => {
    const colors = [
      "from-blue-500 to-purple-600",
      "from-green-500 to-teal-600", 
      "from-red-500 to-pink-600",
      "from-yellow-500 to-orange-600",
    ];
    return colors[avatar.charCodeAt(0) % colors.length];
  };

  if (showLoginModal) {
    return (
      <UserLoginModal
        isOpen={showLoginModal}
        onLogin={handleLogin}
      />
    );
  }

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* User Profile */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 bg-gradient-to-br ${getAvatarColor(currentUser.avatar)} rounded-full flex items-center justify-center`}>
              <span className="text-white font-semibold text-2xl">{currentUser.avatar}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{currentUser.name}</h2>
              <p className="text-gray-600">Customer ID: {currentUser.customerId}</p>
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-500">Connected</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Interface */}
      <Card className="mb-6">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <Headphones className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900">Voice Chat with Admin</h3>
            <p className="text-gray-600 mt-2">Click the button below to start a call with our support team</p>
          </div>

          {callState === "idle" && (
            <div className="space-y-4">
              <Button
                onClick={callAdmin}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full text-lg font-medium hover:scale-105 transition-all flex items-center space-x-3 mx-auto"
              >
                <Phone className="h-5 w-5" />
                <span>Call Admin</span>
              </Button>
              <p className="text-sm text-gray-500">Support is available 24/7</p>
            </div>
          )}

          {callState === "calling" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4">
                <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                  <Phone className="h-6 w-6 text-white" />
                </div>
              </div>
              <h4 className="text-lg font-medium text-gray-900">Calling Admin...</h4>
              <p className="text-gray-600">Please wait while we connect you</p>
              <Button
                onClick={endCall}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md"
              >
                Cancel Call
              </Button>
            </div>
          )}

          {callState === "connected" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <Mic className="h-6 w-6 text-white" />
                </div>
              </div>
              <h4 className="text-lg font-medium text-green-500">Connected to Admin</h4>
              <p className="text-gray-600">Call duration: {formatDuration(callDuration)}</p>
              <div className="flex items-center justify-center space-x-4">
                <Button
                  onClick={toggleMute}
                  className={`${isMuted ? "bg-gray-500 hover:bg-gray-600" : "bg-green-500 hover:bg-green-600"} text-white px-4 py-2 rounded-md`}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isMuted ? "Unmute" : "Mute"}
                </Button>
                <Button
                  onClick={endCall}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md"
                >
                  End Call
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Recent Calls</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Call with Admin</p>
                  <p className="text-xs text-gray-500">Today, 2:30 PM - Duration: 5:42</p>
                </div>
              </div>
              <Badge variant="secondary">Completed</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Call with Admin</p>
                  <p className="text-xs text-gray-500">Yesterday, 10:15 AM - Duration: 3:22</p>
                </div>
              </div>
              <Badge variant="secondary">Completed</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Modal */}
      <CallModal
        isOpen={showCallModal}
        type={callModalType}
        caller={activeCall?.caller || { id: "", name: "", avatar: "" }}
        duration={formatDuration(callDuration)}
        isMuted={isMuted}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
      />
    </div>
  );
}
