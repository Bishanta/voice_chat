import { users, calls, type User, type InsertUser, type Call, type InsertCall } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByCustomerId(customerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(customerId: string, status: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getAdminUsers(): Promise<User[]>;
  getCustomerUsers(): Promise<User[]>;

  // Call methods
  createCall(call: InsertCall): Promise<Call>;
  getCall(id: number): Promise<Call | undefined>;
  updateCallStatus(id: number, status: string, endedAt?: Date, duration?: number): Promise<Call | undefined>;
  getUserCalls(userId: number): Promise<Call[]>;
  getActiveCallForUser(userId: number): Promise<Call | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private calls: Map<number, Call>;
  private currentUserId: number;
  private currentCallId: number;

  constructor() {
    this.users = new Map();
    this.calls = new Map();
    this.currentUserId = 1;
    this.currentCallId = 1;
    
    // Initialize with dummy data
    this.initializeDummyData();
  }

  private initializeDummyData() {
    const dummyUsers: InsertUser[] = [
      {
        customerId: "ADMIN001",
        name: "Admin User",
        avatar: "AD",
        status: "offline",
        isAdmin: true,
      },
      {
        customerId: "ADMIN002",
        name: "Admin User 2",
        avatar: "AD2",
        status: "offline",
        isAdmin: true,
      },
      {
        customerId: "CUST001",
        name: "John Doe",
        avatar: "JD",
        status: "offline",
        isAdmin: false,
      },
      {
        customerId: "CUST002",
        name: "Sarah Miller",
        avatar: "SM",
        status: "offline",
        isAdmin: false,
      },
      {
        customerId: "CUST003",
        name: "Michael Johnson",
        avatar: "MJ",
        status: "offline",
        isAdmin: false,
      },
    ];

    dummyUsers.forEach(async (userData) => {
      await this.createUser(userData);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByCustomerId(customerId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.customerId === customerId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      status: 'offline',
      isAdmin: false,
      createdAt: new Date(),
      ...insertUser,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserStatus(customerId: string, status: string): Promise<User | undefined> {
    const user = await this.getUserByCustomerId(customerId);
    if (user) {
      user.status = status;
      this.users.set(user.id, user);
      return user;
    }
    return undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getAdminUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.isAdmin);
  }

  async getCustomerUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => !user.isAdmin);
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const id = this.currentCallId++;
    const call: Call = {
      ...insertCall,
      id,
      startedAt: new Date(),
      endedAt: null,
      duration: null,
    };
    this.calls.set(id, call);
    return call;
  }

  async getCall(id: number): Promise<Call | undefined> {
    return this.calls.get(id);
  }

  async updateCallStatus(id: number, status: string, endedAt?: Date, duration?: number): Promise<Call | undefined> {
    const call = this.calls.get(id);
    if (call) {
      call.status = status;
      if (endedAt) call.endedAt = endedAt;
      if (duration) call.duration = duration;
      this.calls.set(id, call);
      return call;
    }
    return undefined;
  }

  async getUserCalls(userId: number): Promise<Call[]> {
    return Array.from(this.calls.values()).filter(
      call => call.callerId === userId || call.receiverId === userId
    );
  }

  async getActiveCallForUser(userId: number): Promise<Call | undefined> {
    return Array.from(this.calls.values()).find(
      call => 
        (call.callerId === userId || call.receiverId === userId) &&
        (call.status === "initiated" || call.status === "ringing" || call.status === "connected")
    );
  }
}

export const storage = new MemStorage();
