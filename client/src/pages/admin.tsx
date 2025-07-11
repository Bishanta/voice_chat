import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Headphones, Phone, Users } from "lucide-react";
import { AdminLoginModal } from "@/components/admin-login-modal";
import { CallModal } from "@/components/call-modal";
import { useSocket } from "@/hooks/use-socket";
import { useWebRTC } from "@/hooks/use-webrtc";
import { audioManager } from "@/lib/audio-context";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { WSMessage } from "@shared/schema";

export default function AdminPage() {
  // ...existing code
  // Add audio refs from useWebRTC
  const {
    initializeWebRTC,
    isMuted,
    toggleMute,
    endCall: endWebRTCCall,
    initializePeerConnection,
    remoteAudioRef
  } = useWebRTC();
  const { initSocket, isConnected, sendMessage } = useSocket();

  // const [currentAdmin, setCurrentAdmin] = useState<User | null>(null);
  const currentAdminRef = useRef<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [customers, setCustomers] = useState<User[]>([]);
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const activeCallRef = useRef(activeCall);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);
  const [callDuration, setCallDuration] = useState(0);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callModalType, setCallModalType] = useState<"incoming" | "outgoing" | "active">("incoming");

  const { data: customersData } = useQuery<User[]>({
    queryKey: ["/api/users/customers"],
    refetchInterval: 5000,
    enabled: !!currentAdminRef.current, // Only fetch customers when admin is logged in
  });

  const handleWebSocketMessage = useCallback((message: WSMessage) => {
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
      case 'user_status_update':
        handleUserStatusUpdate(message.data);
        break;
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate':
        // These will be handled by the WebRTC hook when it's initialized
        break;
    }
  }, []);



  const loginMutation = useMutation({
    mutationFn: async (accessCode: string) => {
      const response = await apiRequest("POST", "/api/auth/admin/login", { accessCode });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }
      return response.json();
    },
    onSuccess: async (user: User) => {
      // setCurrentAdmin(user);
      currentAdminRef.current = user;
      setShowLoginModal(false);
      const socket = await initSocket(handleWebSocketMessage, user);
      await initializeWebRTC(socket);
      // socket.emit('admin_register', {
      //   data: {
      //     adminId: user.customerId,
      //   },
      // });
      // sendMessage({
      //   type: 'admin_register',
      //   data: {
      //     adminId: user.customerId,
      //   },
      // });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (customersData) {
      setCustomers(customersData);
    }
  }, [customersData]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCall && callModalType === "active") {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall, callModalType]);

  const handleIncomingCall = (data: any) => {
    setIncomingCalls(prev => [...prev, data]);
    setActiveCall(data);
    setCallModalType("incoming");
    setShowCallModal(true);
    audioManager.playRingTone();
  };

  const handleCallAccepted = (data: any) => {
    console.log("Call accepted", data, currentAdminRef.current)
    if(currentAdminRef.current?.customerId === data.receiverId || currentAdminRef.current?.customerId === data.callerId){
      console.log("User accepted call")
      audioManager.stopRingTone();
      setCallModalType("active");
      setCallDuration(0);
      // initializePeerConnection(data, true);
    }
    else {
      setShowCallModal(false);
      audioManager.stopRingTone();

    }
  };

  const handleCallDeclined = (data: any) => {
    audioManager.stopRingTone();
    setShowCallModal(false);
    setActiveCall(null);
    setIncomingCalls(prev => prev.filter(call => call.callId !== data.callId));
  };

  const handleCallEnded = (data: any) => {
    audioManager.stopRingTone();
    setShowCallModal(false);
    setActiveCall(null);
    setCallDuration(0);
    setIncomingCalls(prev => prev.filter(call => call.callId !== data.callId));
    endWebRTCCall();
  };

  const handleUserStatusUpdate = (data: any) => {
    setCustomers(prev => 
      prev.map(customer => 
        customer.customerId === data.userId 
          ? { ...customer, status: data.status }
          : customer
      )
    );
  };

  const callCustomer = (customer: User) => {
    if (!currentAdminRef.current) return;
    audioManager.resumeAudioContext();
    const callId = `call_${Date.now()}`;
    const callData = {
      callId,
      caller: {
        id: currentAdminRef.current.customerId,
        name: currentAdminRef.current.name,
        avatar: currentAdminRef.current.avatar,
      },
      receiver: {
        id: customer.customerId,
        name: customer.name,
        avatar: customer.avatar,
      },
    };

    setActiveCall(callData);
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
      sendMessage({
        type: 'call_accepted',
        data: {
          callId: activeCall.callId,
        },
      });

      audioManager.stopRingTone();
      setCallModalType("active");
      setCallDuration(0);
      initializePeerConnection(activeCall, true);
      // UI state will be updated by the call_accepted websocket message
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
      // UI state will be updated by the call_declined websocket message
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
      // UI state will be updated by the call_ended websocket message
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'calling': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Available';
      case 'busy': return 'Busy';
      case 'calling': return 'Calling you';
      default: return 'Offline';
    }
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

  const handleLogin = (accessCode: string) => {
    loginMutation.mutate(accessCode);
  };

  if (showLoginModal) {
    return <AdminLoginModal isOpen={showLoginModal} onLogin={handleLogin} />;
  }

  if (!currentAdminRef.current) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center space-x-2">
                <Headphones className="h-6 w-6" />
                <span>Admin Dashboard</span>
              </CardTitle>
              <p className="text-gray-600 mt-1">Welcome, {currentAdminRef.current?.customerId}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'} rounded-full`}></div>
                <span className="text-sm text-gray-600">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              {incomingCalls.length > 0 && (
                <Badge variant="destructive" className="px-3 py-1">
                  {incomingCalls.length} incoming call{incomingCalls.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Customer Directory</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${getAvatarColor(customer.avatar)} rounded-full flex items-center justify-center`}>
                    <span className="text-white font-semibold text-lg">{customer.avatar}</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{customer.name}</h4>
                    <p className="text-sm text-gray-600">Customer ID: {customer.customerId}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className={`w-2 h-2 ${getStatusColor(customer.status)} rounded-full ${customer.status === 'calling' ? 'animate-pulse' : ''}`}></div>
                      <span className="text-xs text-gray-500">{getStatusText(customer.status)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => callCustomer(customer)}
                    disabled={customer.status !== 'available'}
                    className={`px-4 py-2 rounded-md flex items-center space-x-2 ${
                      customer.status !== 'available' 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-primary hover:bg-primary-600 text-white'
                    }`}
                  >
                    <Phone className="h-4 w-4" />
                    <span>Call</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CallModal
        isOpen={showCallModal}
        type={callModalType}
        caller={activeCall?.caller || activeCall?.receiver || { id: "", name: "", avatar: "" }}
        duration={formatDuration(callDuration)}
        isMuted={isMuted}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        remoteAudioRef={remoteAudioRef}
      />
    </div>
    </>
  );
}
