import { useRef, useCallback, useState } from 'react';

export function useWebRTC(callId: string, isInitiator: boolean = false, sendMessage?: (message: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleWebRTCMessage = useCallback(async (message: any) => {
    if (!peerConnectionRef.current || !callId) return;

    switch (message.type) {
      case 'webrtc_offer':
        if (message.data.callId === callId) {
          await handleOffer(message.data.offer);
        }
        break;
      case 'webrtc_answer':
        if (message.data.callId === callId) {
          await handleAnswer(message.data.answer);
        }
        break;
      case 'webrtc_ice_candidate':
        if (message.data.callId === callId) {
          await handleIceCandidate(message.data.candidate);
        }
        break;
    }
  }, [callId]);

  const initializePeerConnection = useCallback(async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      setLocalStream(stream);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Add local stream
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && sendMessage) {
          sendMessage({
            type: 'webrtc_ice_candidate',
            data: {
              callId,
              candidate: event.candidate,
            },
          });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setIsConnected(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setIsConnected(false);
        }
      };

      peerConnectionRef.current = pc;

      if (isInitiator) {
        await createOffer();
      }
    } catch (error) {
      console.error('Failed to initialize peer connection:', error);
    }
  }, [callId, isInitiator, sendMessage]);

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      if (sendMessage) {
        sendMessage({
          type: 'webrtc_offer',
          data: {
            callId,
            offer,
          },
        });
      }
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  }, [callId, sendMessage]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (sendMessage) {
        sendMessage({
          type: 'webrtc_answer',
          data: {
            callId,
            answer,
          },
        });
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }, [callId, sendMessage]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [localStream, isMuted]);

  const endCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    setRemoteStream(null);
    setIsConnected(false);
    setIsMuted(false);
  }, [localStream]);

  return {
    isConnected,
    localStream,
    remoteStream,
    isMuted,
    localAudioRef,
    remoteAudioRef,
    initializePeerConnection,
    toggleMute,
    endCall,
    handleWebRTCMessage,
  };
}
