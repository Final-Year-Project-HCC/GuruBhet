# Socket.IO Client Implementation Guide

## Overview

This guide provides complete client-side implementation for secure real-time messaging with Socket.IO and HttpOnly cookies in Next.js.

**Key Principle**: `withCredentials: true` ensures HttpOnly cookies are automatically sent in the Socket.IO handshake.

---

## Socket.IO Service Layer

### 1. Socket Service Class

**File**: `src/services/socket.ts`

```typescript
import io, { Socket as ClientSocket } from "socket.io-client";
import { Message, Notification, TypingStatus } from "@/types/communication";

interface SocketConfig {
  url: string;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

class SocketService {
  private socket: ClientSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Connect to Socket.IO server.
   *
   * withCredentials: true ensures HttpOnly cookies are sent in the handshake.
   * This is how the backend receives the JWT token without query parameters.
   */
  connect(config: SocketConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(config.url, {
          withCredentials: true, // CRITICAL: Send cookies in handshake
          reconnection: config.reconnection !== false,
          reconnectionDelay: config.reconnectionDelay || 1000,
          reconnectionDelayMax: config.reconnectionDelayMax || 5000,
          reconnectionAttempts: config.reconnectionAttempts || 5,
          transports: ["websocket", "polling"], // Prefer websocket
        });

        // Connection successful
        this.socket.on("connect", () => {
          console.log("✓ Connected to Socket.IO server:", this.socket?.id);
          resolve();
        });

        // Server confirmed connection
        this.socket.on("connect_response", (data) => {
          console.log("✓ Server acknowledged connection:", data);
        });

        // Connection errors
        this.socket.on("connect_error", (error: any) => {
          console.error("✗ Socket.IO connection error:", error);
          reject(error);
        });

        // Disconnection
        this.socket.on("disconnect", (reason) => {
          console.log("✗ Disconnected from server:", reason);
          this.notifyListeners("disconnect", { reason });
        });

        // Reconnection attempts
        this.socket.on("reconnect_attempt", () => {
          console.log("→ Attempting to reconnect...");
        });

        this.socket.on("reconnect", () => {
          console.log("✓ Reconnected to server");
          this.notifyListeners("reconnect", {});
        });
      } catch (error) {
        console.error("Failed to create Socket.IO instance:", error);
        reject(error);
      }
    });
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket ID (useful for debugging).
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Register listener for socket event.
   * Multiple listeners can subscribe to the same event.
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);

      // Register with Socket.IO server
      this.socket?.on(event, (data) => {
        this.notifyListeners(event, data);
      });
    }

    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unregister listener.
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to server and wait for acknowledgment.
   */
  emit(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      this.socket.emit(event, data, (ack: any) => {
        if (ack?.error) {
          reject(new Error(ack.error));
        } else {
          resolve(ack);
        }
      });
    });
  }

  /**
   * Notify all listeners for an event.
   */
  private notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in listener for event "${event}":`, error);
      }
    });
  }

  /**
   * Disconnect from server.
   */
  disconnect(): void {
    if (this.socket?.connected) {
      this.socket.disconnect();
      this.listeners.clear();
      console.log("✓ Disconnected from Socket.IO server");
    }
  }

  /**
   * Clean up on app unload.
   */
  cleanup(): void {
    this.disconnect();
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
```

### 2. Communication Event Handlers

**File**: `src/services/socketHandlers.ts`

```typescript
import { socketService } from "@/services/socket";
import { Message, Notification } from "@/types/communication";

/**
 * Register all Socket.IO event listeners for communication features.
 *
 * This should be called once on app initialization or when socket connects.
 */
export function setupCommunicationHandlers(options?: {
  onMessage?: (message: Message) => void;
  onNotification?: (notification: Notification) => void;
  onTyping?: (data: { user_id: string; is_typing: boolean }) => void;
  onUserOnline?: (user_id: string) => void;
  onUserOffline?: (user_id: string) => void;
  onError?: (error: any) => void;
}) {
  // Incoming message
  socketService.on("message_received", (message: Message) => {
    console.log("📨 Message received:", message);
    options?.onMessage?.(message);
  });

  // Notification (booking request, approval, etc.)
  socketService.on("notification_received", (notification: Notification) => {
    console.log("🔔 Notification received:", notification);
    options?.onNotification?.(notification);
  });

  // Typing indicator
  socketService.on("user_typing", (data) => {
    console.log("⌨️  User typing:", data);
    options?.onTyping?.(data);
  });

  // User online/offline status
  socketService.on("user_online", (data) => {
    console.log("🟢 User online:", data.user_id);
    options?.onUserOnline?.(data.user_id);
  });

  socketService.on("user_offline", (data) => {
    console.log("⚫ User offline:", data.user_id);
    options?.onUserOffline?.(data.user_id);
  });

  // Error handling
  socketService.on("error", (error) => {
    console.error("🚨 Socket.IO error:", error);
    options?.onError?.(error);
  });
}

/**
 * Send a message via Socket.IO (real-time only, no HTTP fallback).
 *
 * Note: This is for real-time sync. To send a message, use the HTTP API:
 *   POST /api/v1/messages
 *
 * This Socket.IO event is for sync between multiple tabs/windows.
 */
export async function emitMessage(data: {
  receiver_id: string;
  content: string;
  message_type?: "TEXT" | "FILE";
  file_url?: string;
  booking_id?: string;
}) {
  try {
    const ack = await socketService.emit("send_message", data);
    console.log("✓ Message emit acknowledged:", ack);
    return ack;
  } catch (error) {
    console.error("✗ Failed to emit message:", error);
    throw error;
  }
}

/**
 * Emit typing status (not persisted, just for UI feedback).
 */
export async function emitTypingStatus(data: {
  receiver_id: string;
  is_typing: boolean;
}) {
  try {
    await socketService.emit("typing_status", data);
  } catch (error) {
    console.error("✗ Failed to emit typing status:", error);
  }
}

/**
 * Mark messages as read.
 */
export async function markMessagesAsRead(message_ids: string[]) {
  try {
    const ack = await socketService.emit("mark_as_read", { message_ids });
    console.log("✓ Messages marked as read:", ack);
    return ack;
  } catch (error) {
    console.error("✗ Failed to mark messages as read:", error);
    throw error;
  }
}
```

---

## API Client

### API Service for HTTP Endpoints

**File**: `src/services/api.ts`

```typescript
import { Message, MessageCreate } from "@/types/communication";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Send a message via HTTP (Database-First approach).
 *
 * Flow:
 * 1. POST /messages saves to PostgreSQL
 * 2. Backend emits Socket.IO event to recipient
 * 3. Response includes message ID and timestamp
 */
export async function sendMessage(data: MessageCreate): Promise<Message> {
  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: "POST",
    credentials: "include", // Include HttpOnly cookies
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to send message");
  }

  return response.json();
}

/**
 * Get conversation history with a user.
 */
export async function getConversation(
  userId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{
  messages: Message[];
  total: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(`${API_BASE_URL}/messages/${userId}?${params}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch conversation");
  }

  return response.json();
}

/**
 * Create a booking request.
 */
export async function createBookingRequest(data: {
  teacher_id: string;
  subject_id: string;
  total_sessions: number;
  session_duration_minutes: number;
  rate_per_session: number;
}) {
  const response = await fetch(`${API_BASE_URL}/booking-requests`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create booking request");
  }

  return response.json();
}

/**
 * Approve a booking request (teacher only).
 */
export async function approveBookingRequest(bookingId: string) {
  const response = await fetch(
    `${API_BASE_URL}/booking-requests/${bookingId}/approve`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to approve booking");
  }

  return response.json();
}

/**
 * Reject a booking request (teacher only).
 */
export async function rejectBookingRequest(bookingId: string, reason: string) {
  const response = await fetch(
    `${API_BASE_URL}/booking-requests/${bookingId}/reject`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rejection_reason: reason }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to reject booking");
  }

  return response.json();
}
```

---

## React Hooks

### useSocket Hook

**File**: `src/hooks/useSocket.ts`

```typescript
import { useEffect, useCallback, useRef } from "react";
import { socketService } from "@/services/socket";

/**
 * Hook to manage Socket.IO connection lifecycle.
 *
 * Usage:
 * const socket = useSocket('http://localhost:8000');
 */
export function useSocket(apiUrl: string, onError?: (error: any) => void) {
  const connectionAttempted = useRef(false);

  useEffect(() => {
    // Prevent multiple connection attempts
    if (connectionAttempted.current) return;
    connectionAttempted.current = true;

    const connect = async () => {
      try {
        await socketService.connect({ url: apiUrl });
      } catch (error) {
        console.error("Failed to connect:", error);
        onError?.(error);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      socketService.cleanup();
    };
  }, [apiUrl, onError]);

  return socketService;
}
```

### useMessages Hook

**File**: `src/hooks/useMessages.ts`

```typescript
import { useState, useCallback, useEffect } from "react";
import { Message } from "@/types/communication";
import { socketService } from "@/services/socket";
import { sendMessage, getConversation } from "@/services/api";

export interface UseMessagesOptions {
  recipientId: string;
  autoLoad?: boolean;
  limit?: number;
}

/**
 * Hook to manage messages for a conversation.
 *
 * Features:
 * - Load conversation history from DB
 * - Receive new messages via Socket.IO
 * - Handle message sending
 * - Track loading and error states
 */
export function useMessages({
  recipientId,
  autoLoad = true,
  limit = 50,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Load conversation history
  const loadConversation = useCallback(
    async (offset = 0) => {
      try {
        setLoading(true);
        setError(null);

        const data = await getConversation(recipientId, limit, offset);

        if (offset === 0) {
          setMessages(data.messages);
        } else {
          setMessages((prev) => [...prev, ...data.messages]);
        }

        setHasMore(offset + limit < data.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
      } finally {
        setLoading(false);
      }
    },
    [recipientId, limit],
  );

  // Load initial conversation on mount
  useEffect(() => {
    if (autoLoad && recipientId) {
      loadConversation(0);
    }
  }, [recipientId, autoLoad, loadConversation]);

  // Listen for new messages
  useEffect(() => {
    const handleNewMessage = (message: Message) => {
      // Only add if it's for this conversation
      if (
        message.sender_id === recipientId ||
        message.receiver_id === recipientId
      ) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    };

    socketService.on("message_received", handleNewMessage);

    return () => {
      socketService.off("message_received", handleNewMessage);
    };
  }, [recipientId]);

  // Send message
  const send = useCallback(
    async (content: string, messageType = "TEXT") => {
      try {
        const message = await sendMessage({
          receiver_id: recipientId,
          content,
          message_type: messageType as "TEXT" | "FILE",
        });

        // Optimistically add to messages
        // (Also received via Socket.IO from backend)
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });

        return message;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        throw err;
      }
    },
    [recipientId],
  );

  // Load more messages (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    loadConversation(messages.length);
  }, [messages.length, hasMore, loading, loadConversation]);

  return {
    messages,
    loading,
    error,
    hasMore,
    send,
    loadMore,
    loadConversation,
  };
}
```

### useNotifications Hook

**File**: `src/hooks/useNotifications.ts`

```typescript
import { useState, useCallback, useEffect } from "react";
import { Notification } from "@/types/communication";
import { socketService } from "@/services/socket";

/**
 * Hook to manage real-time notifications.
 *
 * Notifications include:
 * - Booking requests
 * - Booking approvals/rejections
 * - Session initiations
 * - Payment confirmations
 * - etc.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen for new notifications
  useEffect(() => {
    const handleNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.is_read) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socketService.on("notification_received", handleNotification);

    return () => {
      socketService.off("notification_received", handleNotification);
    };
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    clear,
  };
}
```

---

## React Components

### ChatWindow Component

**File**: `src/components/ChatWindow.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useSocket } from '@/hooks/useSocket';
import { emitTypingStatus } from '@/services/socketHandlers';

interface ChatWindowProps {
    recipientId: string;
    recipientName: string;
}

export function ChatWindow({ recipientId, recipientName }: ChatWindowProps) {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Initialize Socket.IO connection
    const socket = useSocket(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

    // Get messages for this conversation
    const {
        messages,
        loading,
        error,
        hasMore,
        send,
        loadMore,
    } = useMessages({ recipientId });

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!input.trim()) return;

        try {
            const content = input;
            setInput('');

            // Send message (HTTP endpoint)
            await send(content);

            // Clear typing indicator
            setIsTyping(false);
            await emitTypingStatus({ receiver_id: recipientId, is_typing: false });
        } catch (err) {
            console.error('Failed to send message:', err);
            setInput(input); // Restore input on error
        }
    };

    const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInput(value);

        // Emit typing indicator
        const nowTyping = value.length > 0;
        if (isTyping !== nowTyping) {
            setIsTyping(nowTyping);
            await emitTypingStatus({
                receiver_id: recipientId,
                is_typing: nowTyping,
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                    {recipientName}
                </h2>
                <p className="text-sm text-gray-500">
                    {socket.isConnected() ? '🟢 Online' : '⚫ Offline'}
                </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading && !messages.length && (
                    <div className="flex justify-center">
                        <p className="text-gray-500">Loading messages...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-red-600">{error}</p>
                    </div>
                )}

                {hasMore && (
                    <button
                        onClick={loadMore}
                        disabled={loading}
                        className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                    >
                        {loading ? 'Loading...' : 'Load earlier messages'}
                    </button>
                )}

                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`flex ${
                            message.sender_id === recipientId ? 'justify-start' : 'justify-end'
                        }`}
                    >
                        <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                                message.sender_id === recipientId
                                    ? 'bg-gray-200 text-gray-900'
                                    : 'bg-blue-500 text-white'
                            }`}
                        >
                            <p>{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                                {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-gray-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={handleInput}
                        placeholder="Type a message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}
```

### Notifications Panel

**File**: `src/components/NotificationsPanel.tsx`

```typescript
'use client';

import React, { useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { setupCommunicationHandlers } from '@/services/socketHandlers';

export function NotificationsPanel() {
    const { notifications, unreadCount, markAsRead, clear } = useNotifications();

    // Setup socket handlers on mount
    useEffect(() => {
        setupCommunicationHandlers({
            onNotification: (notification) => {
                // Optional: Show toast/alert
                console.log('📢 New notification:', notification);
            },
        });
    }, []);

    return (
        <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                    <span className="px-2 py-1 bg-red-500 text-white rounded-full text-sm font-semibold">
                        {unreadCount}
                    </span>
                )}
            </div>

            {notifications.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No notifications</p>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {notifications.map(notification => (
                        <div
                            key={notification.id}
                            className={`p-3 rounded-lg border-l-4 cursor-pointer ${
                                notification.is_read
                                    ? 'bg-gray-50 border-gray-300'
                                    : 'bg-blue-50 border-blue-500'
                            }`}
                            onClick={() => markAsRead(notification.id)}
                        >
                            <p className="font-semibold text-sm">{notification.title}</p>
                            <p className="text-sm text-gray-600">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {new Date(notification.created_at).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {notifications.length > 0 && (
                <button
                    onClick={clear}
                    className="mt-4 w-full py-2 text-sm text-blue-600 hover:text-blue-700"
                >
                    Clear all
                </button>
            )}
        </div>
    );
}
```

---

## App Integration

### Root Layout Setup

**File**: `src/app/layout.tsx`

```typescript
'use client';

import React from 'react';
import { useSocket } from '@/hooks/useSocket';
import { setupCommunicationHandlers } from '@/services/socketHandlers';
import { useNotifications } from '@/hooks/useNotifications';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Initialize Socket.IO once
    useSocket(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', (error) => {
        console.error('Socket connection failed:', error);
        // Optionally show notification to user
    });

    // Setup event handlers
    React.useEffect(() => {
        setupCommunicationHandlers({
            onError: (error) => console.error('Communication error:', error),
        });
    }, []);

    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
```

### Chat Page Example

**File**: `src/app/chat/[userId]/page.tsx`

```typescript
'use client';

import React from 'react';
import { ChatWindow } from '@/components/ChatWindow';
import { NotificationsPanel } from '@/components/NotificationsPanel';

interface ChatPageProps {
    params: {
        userId: string;
    };
}

export default function ChatPage({ params }: ChatPageProps) {
    // Fetch user name (placeholder)
    const userName = 'John Doe';

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 h-screen">
            {/* Chat window (main) */}
            <div className="md:col-span-3">
                <ChatWindow
                    recipientId={params.userId}
                    recipientName={userName}
                />
            </div>

            {/* Notifications panel (sidebar) */}
            <div className="md:col-span-1">
                <NotificationsPanel />
            </div>
        </div>
    );
}
```

---

## TypeScript Types

**File**: `src/types/communication.ts`

```typescript
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: "TEXT" | "FILE";
  file_url?: string;
  booking_id?: string;
  session_id?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface MessageCreate {
  receiver_id: string;
  content: string;
  message_type?: "TEXT" | "FILE";
  file_url?: string;
  file_public_id?: string;
  booking_id?: string;
  session_id?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  booking_id?: string;
  session_id?: string;
  sender_id?: string;
  payload?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface TypingStatus {
  user_id: string;
  is_typing: boolean;
}
```

---

## Environment Configuration

**File**: `.env.local`

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Socket.IO server URL (usually same as API)
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000

# Enable debug logging
NEXT_PUBLIC_DEBUG=true
```

---

## Key Security Points

1. **`withCredentials: true`** in Socket.IO initialization
2. **`credentials: 'include'`** in all fetch requests
3. **No token in localStorage** (tokens only in HttpOnly cookies)
4. **No token in URL** (never passed as query parameter)
5. **HTTPS in production** (required for secure cookies)
6. **SameSite=Strict** on cookies (CSRF protection)

---

## Testing

### Unit Tests

```typescript
// src/__tests__/services/socket.test.ts
import { socketService } from "@/services/socket";

describe("SocketService", () => {
  it("should connect with withCredentials", async () => {
    const connectSpy = jest.fn();
    socketService.on("connect", connectSpy);

    await socketService.connect({
      url: "http://localhost:8000",
    });

    expect(connectSpy).toHaveBeenCalled();
  });

  it("should handle disconnection", (done) => {
    socketService.on("disconnect", ({ reason }) => {
      expect(reason).toBeDefined();
      done();
    });

    socketService.disconnect();
  });
});
```

---

## Deployment Checklist

- [ ] HTTPS enabled (required for secure cookies)
- [ ] Backend CORS configured for frontend domains
- [ ] `credentials: 'include'` in all API calls
- [ ] `withCredentials: true` in Socket.IO client
- [ ] Redis adapter configured for Socket.IO (if multiple servers)
- [ ] Database backups configured
- [ ] Error logging/monitoring set up
- [ ] Rate limiting configured
- [ ] CSRF tokens verified (if traditional forms used)

---

## Troubleshooting

### "withCredentials" warning in console

**Cause**: Socket.IO trying to send cookies but CORS not allowing it
**Fix**: Ensure backend CORS config includes `credentials: true` for your domain

### Messages not appearing on other client

**Cause**: Different browser/device not receiving Socket.IO events
**Solution**: This is expected. Use HTTP API to fetch conversation history:

```typescript
const conversation = await getConversation(userId);
```

### Socket keeps reconnecting

**Cause**: JWT expired or authentication failed
**Fix**: Check cookie expiration and implement refresh token logic

See main architecture document for more details.
