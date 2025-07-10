import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { wsMessageSchema, type WSMessage } from "@shared/schema";
import { z } from "zod";

interface SocketClient {
  socket: any;
  userId?: string;
  isAdmin?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  const clients = new Map<string, SocketClient>(); // socketId -> {socket}
  const userSockets = new Map<string, {socketId: string, isAdmin: boolean}>(); // userId -> {socketId, isAdmin}
  const activeCalls = new Map<string, {callerId: string, receiverId?: string}>(); // callId -> {callerId, receiverId}
  setInterval(() => {
    console.log("Clients: ", clients.size);
    console.log("User Sockets: ", userSockets.size);
    console.log("Active Calls: ", activeCalls.size);
  }, 5000);
  
  // REST API routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomerUsers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { customerId } = req.body;
      const user = await storage.getUserByCustomerId(customerId);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid customer ID" });
      }
      //if present in userSockets, throw already logged in
      if (userSockets.has(customerId)) {
        return res.status(401).json({ error: "User already logged in" });
      }
      // Update user status to available
      await storage.updateUserStatus(customerId, "available");
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/admin/login", async (req, res) => {
    try {
      const { accessCode } = req.body;
      const adminUser = await storage.getUserByCustomerId(accessCode);
      if (!adminUser) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      if (userSockets.has(adminUser.customerId)) {
        return res.status(401).json({ error: "Admin already logged in" });
      }

      await storage.updateUserStatus(adminUser.customerId, "available");
      res.json(adminUser);
    } catch (error) {
      res.status(500).json({ error: "Admin login failed" });
    }
  });

  app.post("/api/calls", async (req, res) => {
    try {
      const { callerId, receiverId } = req.body;
      
      const call = await storage.createCall({
        callerId,
        receiverId,
        status: "initiated",
      });

      res.json(call);
    } catch (error) {
      res.status(500).json({ error: "Failed to create call" });
    }
  });

  app.patch("/api/calls/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, duration } = req.body;
      
      const endedAt = status === "ended" ? new Date() : undefined;
      const call = await storage.updateCallStatus(parseInt(id), status, endedAt, duration);
      
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }

      res.json(call);
    } catch (error) {
      res.status(500).json({ error: "Failed to update call" });
    }
  });

  app.get("/api/calls/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const calls = await storage.getUserCalls(parseInt(userId));
      res.json(calls);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user calls" });
    }
  });

  // Socket.io handling
  io.on('connection', (socket) => {
    const socketId = socket.id;
    clients.set(socketId, { socket });

    console.log(`Client connected: ${socketId}`);

    socket.on('message', async (data: any) => {
      console.log(`Client message: ${data.type}`);
      try {
        const parsedMessage = wsMessageSchema.parse(data);
        await handleSocketMessage(socketId, parsedMessage);
      } catch (error) {
        console.error('Socket message error:', error);
        socket.emit('error', { message: 'Invalid message format' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socketId}`)
      const userId = getUserIdFromSocketId(socketId);
      const client = clients.get(socketId);
      if (client) {
        // Update user status to offline
        try {
          const user = await storage.getUserByCustomerId(userId);
          if (user) {
            await storage.updateUserStatus(user.customerId, "offline");
            broadcastUserStatusUpdate(user.customerId, "offline");
          }
        } catch (error) {
          console.error('Error updating user status on disconnect:', error);
        }
      }
      const activeCall = getActiveCallFromUserID(userId);
      if(activeCall){
        activeCalls.delete(activeCall);
      }
      userSockets.delete(userId);
      clients.delete(socketId);
    });
  });

  async function handleSocketMessage(socketId: string, message: WSMessage) {
    switch (message.type) {
      case 'admin_register':
        await handleAdminRegister(socketId, message.data);
        break;
      case 'call_initiated':
        await handleCallInitiated(socketId, message.data);
        break;
      case 'call_accepted':
        await handleCallAccepted(socketId, message.data.callId);
        break;
      case 'call_declined':
        await handleCallDeclined(socketId, message.data.callId);
        break;
      case 'call_ended':
        await handleCallEnded(socketId, message.data.callId);
        break;
      case 'webrtc_offer':
        await handleWebRTCOffer(socketId, message.data);
        break;
      case 'webrtc_answer':
        await handleWebRTCAnswer(socketId, message.data);
        break;
      case 'webrtc_ice_candidate':
        await handleWebRTCIceCandidate(socketId, message.data);
        break;
      case 'user_status_update':
        await handleUserStatusUpdate(socketId, message.data);
        break;
    }
  }

  async function handleAdminRegister(socketId: string, data: any) {
    const client = clients.get(socketId);
    if (!client) return;
    client.isAdmin = true;
    client.userId = data.adminId;
    userSockets.set(data.adminId, {
      socketId,
      isAdmin: true,
    });
  }

  //returns callID
  function getActiveCallFromUserID(userId: string):string | undefined{
    const callArray = Array.from(activeCalls.entries());
    const call = callArray.find(([_, callInfo]) => callInfo.callerId === userId || callInfo.receiverId === userId);
    return call ? call[0] : undefined;
  }

  async function handleCallInitiated(socketId: string, data: any) {
    const client = clients.get(socketId);
    if (!client) return;

    const callInfo: { callerId: string; receiverId?: string } = { 
      callerId: data.caller.id
    }

    activeCalls.set(data.callId, callInfo);
    const userId = getUserIdFromSocketId(socketId);
    const userInfo = userSockets.get(userId)
    if(!userInfo) return;

    if(userInfo.isAdmin && data.receiver.id){
      const receiverInfo = userSockets.get(data.receiver.id);
      const customerSocketId = receiverInfo?.socketId;
      if (customerSocketId) {
        const customerClient = clients.get(customerSocketId);
        if (customerClient) {
          customerClient.socket.emit('message', {
            type: 'call_initiated',
            data: data,
          });
        } else {
          console.log(`Customer ${data.caller.id} not connected`);
        }
      } else {
        console.log(`Customer ${data.caller.id} socket not found`);
      }
    } else {
      broadcastToAdmins('call_initiated', data);
    }
  }

  function broadcastToAdmins(type: string, data: any) {
    const adminSocketIds = Array.from(userSockets.entries())
      .filter(([_, data]) => data.isAdmin)
      .map(([_, data]) => data.socketId);
    
    if (adminSocketIds.length > 0) {
      for (const adminSocketId of adminSocketIds) {
        const adminClient = clients.get(adminSocketId);
        if(adminClient){
          adminClient.socket.emit('message', {
            type,
            data,
          });
          console.log(`Call sent to admin`);
        }
      }
    } else {
      console.log('Admin not connected');
    }
  }

  function getUserIdFromSocketId(socketId: string) {
    //get from userSockets values
    const adminSocketId = Array.from(userSockets.entries())
    .filter(([_, data]) => data.socketId === socketId)
    return adminSocketId[0]?.[0];
  }

  //make sure data has callId and can also have other fields as necessary. but callId is required.
  function distributeMessage(socketId: string, message: WSMessage) {
    const client = clients.get(socketId);
    if (!client) return;
    if(message.type === "admin_register") return;
    if(message.type === "user_status_update") return;
    
    const callInfo = activeCalls.get(message.data.callId);
    if(!callInfo) return;

    if(message.type === "call_accepted" && !callInfo.receiverId) {
      const userId = getUserIdFromSocketId(socketId);
      callInfo.receiverId = userId;
      activeCalls.set(message.data.callId, callInfo)
    }

    const userInfo = userSockets.get(callInfo.callerId);
    //if caller is user
    if(!userInfo?.isAdmin){
      const customerSocketId = userInfo?.socketId;
      if (customerSocketId) {
        const customerClient = clients.get(customerSocketId);
        if (customerClient) {
          customerClient.socket.emit('message', message);
        } else {
          console.log(`Customer ${callInfo.callerId} not connected`);
        }
      } else {
        console.log(`Customer ${callInfo.callerId} socket not found`);
      }
    }

    //should'not get webrtc offer
    const adminSocketIds = Array.from(userSockets.entries())
    .filter(([_, data]) => data.isAdmin)
    .map(([_, data]) => data.socketId);
    if (adminSocketIds.length > 0) {
      for (const adminSocketId of adminSocketIds) {
        const adminClient = clients.get(adminSocketId);
        if (adminClient) {
          adminClient.socket.emit('message', message);
          console.log(`Call accepted by admin`);
        } else {
          console.log(`Admin not connected`);
        }
      }
    } else {
      console.log('Admin not connected');
    }
    
  }

  async function handleCallAccepted(socketId: string, callId: string) {
    const client = clients.get(socketId);
    if (!client) return;
    const callInfo = activeCalls.get(callId);
    if(!callInfo) return;

    const userId = getUserIdFromSocketId(socketId);
    const userInfo = userSockets.get(userId)
    if(!userInfo) return;

    if(!callInfo.receiverId){
      callInfo.receiverId = userId;
      activeCalls.set(callId, callInfo)
    }

    if(userInfo.isAdmin && callInfo.receiverId){
      const recieverId = callInfo.callerId == userId ? callInfo.receiverId : callInfo.callerId;
      const receiverInfo = userSockets.get(recieverId);
      if(!receiverInfo) return;
      const receiverClient = clients.get(receiverInfo.socketId);
      if (receiverClient) {
        receiverClient.socket.emit('message', {
          type: 'call_accepted',
          data: {
            callId,
          },
        });
      } else {
        console.log(`Customer ${recieverId} not connected`);
      }
    }
    
    broadcastToAdmins('call_accepted', {
      callId,
    });

  }

  async function handleCallDeclined(socketId: string, callId: string) {
    const client = clients.get(socketId);
    if (!client) return;
    const callInfo = activeCalls.get(callId);
    if(!callInfo) return;

    const userId = getUserIdFromSocketId(socketId);
    const userInfo = userSockets.get(userId);
    if(!userInfo) return;
    
    if(userInfo.isAdmin && callInfo.receiverId) {
      const recieverId = callInfo.callerId == userId ? callInfo.receiverId : callInfo.callerId;
      const receiverInfo = userSockets.get(recieverId);
      if(!receiverInfo) return;
      const receiverClient = clients.get(receiverInfo.socketId);
      if (receiverClient) {
        receiverClient.socket.emit('message', {
          type: 'call_declined',
          data: {
            callId,
          },
        });
      } else {
        console.log(`Customer ${recieverId} not connected`);
      }
    }
    
    broadcastToAdmins('call_declined', {
      callId,
    });
  }

  async function handleCallEnded(socketId: string, callId: string) {
    const callInfo = activeCalls.get(callId);
    if(!callInfo) return;
    
    const userId = getUserIdFromSocketId(socketId);
    const userInfo = userSockets.get(userId);
    if(!userInfo) return;
    if(userInfo.isAdmin && callInfo.receiverId) {
      const recieverId = callInfo.callerId == userId ? callInfo.receiverId : callInfo.callerId;
      const receiverInfo = userSockets.get(recieverId);
      if(!receiverInfo) return;
      const receiverClient = clients.get(receiverInfo.socketId);
      if (receiverClient) {
        receiverClient.socket.emit('message', {
          type: 'call_ended',
          data: {
            callId,
          },
        });
      } else {
        console.log(`Customer ${recieverId} not connected`);
      }
    }
    
    broadcastToAdmins('call_ended', {
      callId,
    });
    activeCalls.delete(callId);
  }

  async function handleWebRTCOffer(socketId: string, data:any) {
    // distributeMessage(socketId, {
    //   type: 'webrtc_offer',
    //   data: data,
    // });
    // broadcastToCall(data.callId, {
    //   type: 'webrtc_offer',
    //   data: data,
    // }, socketId);
  }

  async function handleWebRTCAnswer(socketId: string, data: any) {
    // distributeMessage(socketId, {
    //   type: 'webrtc_answer',
    //   data: data,
    // });
    // broadcastToCall(data.callId, {
    //   type: 'webrtc_answer',
    //   data: data,
    // }, socketId);
  }

  async function handleWebRTCIceCandidate(socketId: string, data: any) {
    // distributeMessage(socketId, {
    //   type: 'webrtc_ice_candidate',
    //   data: data,
    // });
    // broadcastToCall(data.callId, {
    //   type: 'webrtc_ice_candidate',
    //   data: data,
    // }, socketId);
  }

  async function handleUserStatusUpdate(socketId: string, data: any) {
    const client = clients.get(socketId);
    if (!client) return;
    userSockets.set(data.userId, {
      socketId,
      isAdmin: false,
    });

    await storage.updateUserStatus(data.userId, data.status);
    broadcastUserStatusUpdate(data.userId, data.status);
  }

  function broadcastToCall(callId: string, message: any, excludeSocketId?: string) {
    clients.forEach((client, socketId) => {
      if (excludeSocketId && socketId === excludeSocketId) return;
      if (client.socket.connected) {
        client.socket.emit('message', message);
      }
    });
  }

  function broadcastUserStatusUpdate(userId: string, status: string) {
    const message = {
      type: 'user_status_update',
      data: { userId, status },
    };

    clients.forEach((client) => {
      if (client.socket.connected) {
        client.socket.emit('message', message);
      }
    });
  }

  function generateSocketId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  return httpServer;
}
