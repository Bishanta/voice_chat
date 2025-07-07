import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Headphones, Phone, Users, PhoneCall } from "lucide-react";
import { CallModal } from "@/components/call-modal";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWebRTC } from "@/hooks/use-webrtc";
import { audioManager } from "@/lib/audio-context";
import { User } from "@shared/schema";

export default function AdminPage() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callModalType, setCallModalType] = useState<"incoming" | "outgoing" | "active">("incoming");

  const { data: customersData, refetch: refetchCustomers } = useQuery({
    queryKey: ["/api/users/customers"],
    refetchInterval: 5000,
  });

  const { sendMessage } = useWebSocket((message) => {
    handleWebSocketMessage(message);
  });

  const { 
    isConnected, 
    isMuted, 
    toggleMute, 
    endCall: endWebRTCCall, 
    initializePeerConnection 
  } = useWebRTC(activeCall?.id || "", false);

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

  const handleWebSocketMessage = (message: any) => {
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
    }
  };

  const handleIncomingCall = (data: any) => {
    setIncomingCalls(prev => [...prev, data]);
    setActiveCall(data);
    setCallModalType("incoming");
    setShowCallModal(true);
    audioManager.playRingTone();
  };

  const handleCallAccepted = (data: any) => {
    audioManager.stopRingTone();
    setCallModalType("active");
    setCallDuration(0);
    initializePeerConnection();
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
    audioManager.resumeAudioContext();
    const callId = `call_${Date.now()}`;
    const callData = {
      callId,
      caller: {
        id: "ADMIN001",
        name: "Admin User",
        avatar: "AD",
      },
      receiver: {
        id: customer.customerId,
        name: customer.name,
      },
    };

    setActiveCall(callData);
    setCallModalType("outgoing");
    setShowCallModal(true);

    sendMessage({
      type: 'call_initiated',
      data: callData,
    });
  };

  const acceptCall = () => {
    if (activeCall) {
      sendMessage({
        type: 'call_accepted',
        data: { callId: activeCall.callId },
      });
    }
  };

  const declineCall = () => {
    if (activeCall) {
      sendMessage({
        type: 'call_declined',
        data: { callId: activeCall.callId },
      });
    }
  };

  const endCall = () => {
    if (activeCall) {
      sendMessage({
        type: 'call_ended',
        data: { callId: activeCall.callId },
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'calling':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'busy':
        return 'Busy';
      case 'calling':
        return 'Calling you';
      default:
        return 'Offline';
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Admin Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center space-x-2">
                <Headphones className="h-6 w-6" />
                <span>Admin Dashboard</span>
              </CardTitle>
              <p className="text-gray-600 mt-1">Manage customer calls and communications</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Online</span>
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

      {/* Customer List */}
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
                  <div className="text-sm text-gray-500">
                    {customer.status === 'calling' ? 'Incoming call' : 'Ready to call'}
                  </div>
                  {customer.status === 'calling' ? (
                    <Button
                      onClick={() => callCustomer(customer)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 animate-pulse"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Answer</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => callCustomer(customer)}
                      disabled={customer.status === 'offline'}
                      className={`px-4 py-2 rounded-md flex items-center space-x-2 ${
                        customer.status === 'offline' 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-primary hover:bg-primary-600 text-white'
                      }`}
                    >
                      <Phone className="h-4 w-4" />
                      <span>Call</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Call Modal */}
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
      />
    </div>
  );
}
