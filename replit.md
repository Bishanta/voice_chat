# Voice Chat App

## Overview

This is a full-stack voice chat application built with React, Express.js, and WebSocket/WebRTC technologies. The app enables real-time voice communication between users, with separate interfaces for administrators and regular users. The system uses an in-memory storage solution for development and is designed to handle voice calls with features like user authentication, call management, and real-time status updates.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: React hooks with TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Real-time Communication**: WebSocket for signaling and WebRTC for peer-to-peer voice
- **Database**: PostgreSQL with Drizzle ORM (currently using in-memory storage for development)
- **Authentication**: Simple customer ID-based authentication
- **API**: RESTful endpoints for user management and call operations

### Data Storage
- **Production**: PostgreSQL database with Drizzle ORM
- **Development**: In-memory storage using JavaScript Maps
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Migrations**: Drizzle Kit for schema management

## Key Components

### User Management
- **Admin Users**: Can view all customers and initiate calls
- **Customer Users**: Can receive calls and manage their status
- **User States**: offline, available, busy, calling
- **Authentication**: Customer ID-based login system

### Call Management
- **Call States**: initiated, ringing, connected, ended, declined
- **WebRTC Integration**: Peer-to-peer voice communication
- **Call Controls**: Mute/unmute, accept/decline, end call
- **Call Duration Tracking**: Real-time duration display during active calls

### Real-time Features
- **WebSocket Communication**: For call signaling and user status updates
- **WebRTC**: For actual voice transmission
- **Live Status Updates**: Real-time user availability and call state changes
- **Ring Tone Generation**: Web Audio API for call notifications

## Data Flow

1. **User Authentication**: Users login with customer ID, system validates and updates status
2. **Call Initiation**: Admin selects customer and initiates call via WebSocket
3. **WebRTC Negotiation**: Peer connection establishment with offer/answer exchange
4. **Voice Transmission**: Direct peer-to-peer audio streaming
5. **Call Management**: Status updates broadcasted to all connected clients
6. **Call Termination**: Cleanup of WebRTC connections and status updates

## External Dependencies

### Core Technologies
- **React Ecosystem**: React, React DOM, React Router (Wouter)
- **UI Components**: Radix UI primitives, Lucide React icons
- **Styling**: Tailwind CSS, class-variance-authority, clsx
- **Backend**: Express.js, WebSocket (ws)
- **Database**: Drizzle ORM, PostgreSQL driver
- **Development**: Vite, TypeScript, ESBuild

### WebRTC & Audio
- **WebRTC**: Native browser APIs for peer-to-peer communication
- **Web Audio API**: For ring tone generation and audio processing
- **MediaDevices API**: For microphone access

### Development Tools
- **Replit Integration**: Specialized plugins for Replit environment
- **Hot Reload**: Vite HMR for development
- **Type Checking**: TypeScript with strict mode enabled

## Deployment Strategy

### Development
- **Local Development**: Uses Vite dev server with Express API
- **Hot Reload**: Full-stack hot reload with Vite middleware
- **Environment Variables**: DATABASE_URL for PostgreSQL connection
- **In-Memory Storage**: Development fallback when database unavailable

### Production
- **Build Process**: Vite builds frontend, ESBuild bundles backend
- **Static Assets**: Frontend built to `dist/public`
- **Server Bundle**: Backend bundled to `dist/index.js`
- **Database**: PostgreSQL with Drizzle migrations
- **WebSocket**: Production WebSocket server on same port as HTTP

### Database Setup
- **Schema**: Defined in `shared/schema.ts`
- **Migrations**: Generated in `./migrations` directory
- **Push Command**: `npm run db:push` for schema deployment
- **Connection**: Environment variable `DATABASE_URL` required

## Changelog

```
Changelog:
- July 07, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```