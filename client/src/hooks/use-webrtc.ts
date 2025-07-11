import { useRef, useCallback, useState } from 'react';
import { WSMessage } from '@shared/schema';
import { Socket } from 'socket.io-client';

export function useWebRTC() {
  const [isConnected, setIsConnected] = useState(false);
  // const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const handleWebRTCMessage = useCallback(async (message: any) => {
    if (!peerConnectionRef.current || !socketRef.current) return;
    switch (message.type) {
      case 'webrtc_offer':
        await handleOffer(message.data);
        break;
      case 'webrtc_answer':
        await handleAnswer(message.data);
        break;
      case 'webrtc_ice_candidate':
        await handleIceCandidate(message.data);
        break;
    }
  }, []);

  const addSocketEvents = useCallback((socket: Socket) => {
    socket.on('message', handleWebRTCMessage);
  }, [handleWebRTCMessage]);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    // setRemoteStream(null);
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
    // setLocalStream(stream);
    localAudioRef.current = stream;
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

      console.log("add local stream", localAudioRef.current)
      
      if(localAudioRef.current){
        const localStream = localAudioRef.current;
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // Set up remote stream handling
      remoteAudioRef.current = new MediaStream();
      // Handle remote stream
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          console.log("Remote stream track added", track);
          remoteAudioRef.current?.addTrack(track);
        });
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

  const handleOffer = useCallback(async (data: any) => {
    if (!peerConnectionRef.current) return;

    console.log("handleOffer", data)
    try {
      await peerConnectionRef.current.setRemoteDescription(data.offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('message', {
          type: 'webrtc_answer',
          data: {
            callId: data.callId,
            answer,
          },
        });
      }
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }, []);

  const handleAnswer = useCallback(async (data: any) => {
    if (!peerConnectionRef.current) return;

    console.log("handleAnswer", data)
    try {
      await peerConnectionRef.current.setRemoteDescription(data.answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (data: any) => {
    if (!peerConnectionRef.current) return;

    console.log("handleIceCandidate", data)
    try {
      await peerConnectionRef.current.addIceCandidate(data.candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localAudioRef.current) {
      localAudioRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const endCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // if (localAudioRef.current) {
    //   localAudioRef.current.getTracks().forEach(track => track.stop());
    //   localAudioRef.current = null;
    // }
    
    remoteAudioRef.current = null;
    setIsConnected(false);
    setIsMuted(false);
  }, []);

  return {
    initializeWebRTC,
    isConnected,
    isMuted,
    remoteAudioRef,
    initializePeerConnection,
    toggleMute,
    endCall,
    handleWebRTCMessage,
  };
}
