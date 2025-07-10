import { useRef, useCallback, useState } from 'react';
import { WSMessage } from '@shared/schema';
import { Socket } from 'socket.io-client';

export function useWebRTC() {
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const handleWebRTCMessage = useCallback(async (message: any) => {
    if (!peerConnectionRef.current || !socketRef.current) return;

    switch (message.type) {
      case 'webrtc_offer':
        await handleOffer(message.data.offer);
        break;
      case 'webrtc_answer':
        await handleAnswer(message.data.answer);
        break;
      case 'webrtc_ice_candidate':
        await handleIceCandidate(message.data.candidate);
        break;
    }
  }, []);

  const addSocketEvents = useCallback((socket: Socket) => {
    socket.on('message', handleWebRTCMessage);
  }, []);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setIsConnected(false);
    setIsMuted(false);
  }, []);

  // const handleWebRTCMessage = useCallback(async (message: WSMessage) => {
  //   if (!peerConnectionRef.current || !callId) return;

  //   switch (message.type) {
  //     case 'webrtc_offer':
  //       if (message.data.callId === callId) {
  //         await handleOffer(message.data);
  //       }
  //       break;
  //     case 'webrtc_answer':
  //       if (message.data.callId === callId) {
  //         await handleAnswer(message.data.answer);
  //       }
  //       break;
  //     case 'webrtc_ice_candidate':
  //       if (message.data.callId === callId) {
  //         await handleIceCandidate(message.data.candidate);
  //       }
  //       break;
  //   }
  // }, [callId]);
  const initializeWebRTC = useCallback(async(socket: any) => {
    socketRef.current = socket;
    addSocketEvents(socket);
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: false 
    });
    setLocalStream(stream);
  }, []);

  const initializePeerConnection = useCallback(async (callData: any, isInitiator: boolean = false) => {
    try {
      if(peerConnectionRef.current) {
        await closePeerConnection();
      }
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Add local stream
      localStream?.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
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
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('message', {
            type: 'webrtc_ice_candidate',
            data: {
              callId: callData.callId,
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
        await createOffer(callData);
      }
    } catch (error) {
      console.error('Failed to initialize peer connection:', error);
    }
  }, []);

  const createOffer = useCallback(async (callData: any) => {
    if (!peerConnectionRef.current) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.emit('message', {
          type: 'webrtc_offer',
          data: {
            callId: callData.callId,
            offer,
          },
        });
      }
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  }, []);

  const handleOffer = useCallback(async (callData: any) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(callData.offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('message', {
          type: 'webrtc_answer',
          data: {
            callId: callData.callId,
            answer,
          },
        });
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }, []);

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
    initializeWebRTC,
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
