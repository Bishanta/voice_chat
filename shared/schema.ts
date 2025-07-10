import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull().unique(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  status: text("status").notNull().default("offline"), // offline, available, busy, calling
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  callerId: integer("caller_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  status: text("status").notNull(), // initiated, ringing, connected, ended, declined
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // in seconds
});

export const insertUserSchema = createInsertSchema(users).pick({
  customerId: true,
  name: true,
  avatar: true,
  status: true,
  isAdmin: true,
});

export const insertCallSchema = createInsertSchema(calls).pick({
  callerId: true,
  receiverId: true,
  status: true,
  duration: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof calls.$inferSelect;

// WebSocket message types
export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("admin_register"),
    data: z.object({
      adminId: z.string(),
    }),
  }),
  z.object({
    type: z.literal("call_initiated"),
    data: z.object({
      callId: z.string(),
      caller: z.object({
        id: z.string(),
        name: z.string(),
        avatar: z.string(),
      }),
      receiver: z.object({
        id: z.string(),
        name: z.string(),
      }).optional(),
    }),
  }),
  z.object({
    type: z.literal("call_accepted"),
    data: z.object({
      callId: z.string(),
    }),
  }),
  z.object({
    type: z.literal("call_declined"),
    data: z.object({
      callId: z.string(),
    }),
  }),
  z.object({
    type: z.literal("call_ended"),
    data: z.object({
      callId: z.string(),
    }),
  }),
  z.object({
    type: z.literal("webrtc_offer"),
    data: z.object({
      callId: z.string(),
      offer: z.any(),
    }),
  }),
  z.object({
    type: z.literal("webrtc_answer"),
    data: z.object({
      callId: z.string(),
      answer: z.any(),
    }),
  }),
  z.object({
    type: z.literal("webrtc_ice_candidate"),
    data: z.object({
      callId: z.string(),
      candidate: z.any(),
    }),
  }),
  z.object({
    type: z.literal("user_status_update"),
    data: z.object({
      userId: z.string(),
      status: z.string(),
    }),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;
