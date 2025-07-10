import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";

interface CallModalProps {
  isOpen: boolean;
  type: "incoming" | "outgoing" | "active";
  caller: {
    id: string;
    name: string;
    avatar: string;
  };
  duration?: string;
  isMuted?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onEnd?: () => void;
  onToggleMute?: () => void;
  remoteAudioRef: React.RefObject<MediaStream>;
}

export function CallModal({
  isOpen,
  type,
  caller,
  duration,
  isMuted,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  remoteAudioRef,
}: CallModalProps) {
  // useEffect is not needed for autoplay since it's a prop on the element

  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !remoteAudioRef.current) return;
  
    // Set the MediaStream as the source
    audioElement.srcObject = remoteAudioRef.current;
  
    // Cleanup function
    return () => {
      audioElement.srcObject = null;
    };
  }, [remoteAudioRef.current]);


  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-8 text-center">
          <div className={`w-20 h-20 bg-gradient-to-br ${getAvatarColor(caller.avatar)} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <span className="text-white font-semibold text-2xl">{caller.avatar}</span>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{caller.name}</h3>
          
          {type === "incoming" && (
            <>
              <p className="text-gray-600 mb-6">is calling you...</p>
              <div className="flex space-x-4 justify-center">
                <Button
                  onClick={onAccept}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-md flex items-center space-x-2"
                >
                  <Phone className="h-4 w-4" />
                  <span>Accept</span>
                </Button>
                <Button
                  onClick={onDecline}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-md flex items-center space-x-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  <span>Decline</span>
                </Button>
              </div>
            </>
          )}
          
          {type === "outgoing" && (
            <>
              <p className="text-gray-600 mb-6">Calling...</p>
              <div className="flex justify-center">
                <Button
                  onClick={onEnd}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-md flex items-center space-x-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  <span>Cancel</span>
                </Button>
              </div>
            </>
          )}
          
          {type === "active" && (
            <>
              <p className="text-green-500 mb-2">Connected</p>
              <p className="text-gray-600 mb-6">Call duration: {duration || "00:00"}</p>
              <div className="flex space-x-4 justify-center">
                <Button
                  onClick={onToggleMute}
                  className={`${isMuted ? "bg-gray-500 hover:bg-gray-600" : "bg-green-500 hover:bg-green-600"} text-white px-4 py-2 rounded-md flex items-center space-x-2`}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span>{isMuted ? "Unmute" : "Mute"}</span>
                </Button>
                <Button
                  onClick={onEnd}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md flex items-center space-x-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  <span>End Call</span>
                </Button>
              </div>
            </>
          )}
          
          <audio 
            ref={audioRef} 
            autoPlay 
            playsInline  // Important for iOS
            onError={(e) => console.error('Audio playback error:', e)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
