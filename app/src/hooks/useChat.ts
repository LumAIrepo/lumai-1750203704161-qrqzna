```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { toast } from 'sonner'

export interface ChatMessage {
  id: string
  sender: string
  senderPubkey: string
  content: string
  timestamp: number
  type: 'text' | 'image' | 'system'
  encrypted?: boolean
  signature?: string
  reactions?: Record<string, string[]>
  replyTo?: string
  edited?: boolean
  editedAt?: number
}

export interface ChatRoom {
  id: string
  name: string
  description?: string
  createdBy: string
  createdAt: number
  keyRequired: string
  keyPrice: number
  memberCount: number
  isPrivate: boolean
  lastMessage?: ChatMessage
  participants: string[]
  admins: string[]
  settings: {
    allowImages: boolean
    allowReactions: boolean
    maxMessageLength: number
    slowMode: number
  }
}

export interface ChatState {
  messages: ChatMessage[]
  rooms: ChatRoom[]
  currentRoom: string | null
  isLoading: boolean
  isConnecting: boolean
  error: string | null
  typingUsers: Record<string, number>
  unreadCounts: Record<string, number>
  lastSeen: Record<string, number>
}

interface UseChatOptions {
  roomId?: string
  autoConnect?: boolean
  enableEncryption?: boolean
  maxRetries?: number
}

interface ChatHookReturn {
  state: ChatState
  sendMessage: (content: string, type?: 'text' | 'image', replyTo?: string) => Promise<boolean>
  editMessage: (messageId: string, newContent: string) => Promise<boolean>
  deleteMessage: (messageId: string) => Promise<boolean>
  reactToMessage: (messageId: string, reaction: string) => Promise<boolean>
  joinRoom: (roomId: string) => Promise<boolean>
  leaveRoom: (roomId: string) => Promise<boolean>
  createRoom: (name: string, keyRequired: string, isPrivate: boolean) => Promise<string | null>
  loadMessages: (roomId: string, limit?: number, before?: string) => Promise<void>
  markAsRead: (roomId: string) => void
  setTyping: (isTyping: boolean) => void
  refreshRooms: () => Promise<void>
  clearError: () => void
  disconnect: () => void
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.solsocial.app/ws'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.solsocial.app'
const MAX_MESSAGE_LENGTH = 2000
const TYPING_TIMEOUT = 3000
const RECONNECT_DELAY = 5000
const MAX_RECONNECT_ATTEMPTS = 5

export function useChat(options: UseChatOptions = {}): ChatHookReturn {
  const { roomId, autoConnect = true, enableEncryption = false, maxRetries = 3 } = options
  const { connection } = useConnection()
  const { publicKey, signMessage, connected } = useWallet()
  
  const [state, setState] = useState<ChatState>({
    messages: [],
    rooms: [],
    currentRoom: roomId || null,
    isLoading: false,
    isConnecting: false,
    error: null,
    typingUsers: {},
    unreadCounts: {},
    lastSeen: {}
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const messageQueueRef = useRef<any[]>([])

  const updateState = useCallback((updates: Partial<ChatState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const clearError = useCallback(() => {
    updateState({ error: null })
  }, [updateState])

  const authenticateUser = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !signMessage || !connected) {
      return null
    }

    try {
      const message = `SolSocial Chat Authentication: ${Date.now()}`
      const encodedMessage = new TextEncoder().encode(message)
      const signature = await signMessage(encodedMessage)
      
      const response = await fetch(`${API_BASE_URL}/auth/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: publicKey.toString(),
          message,
          signature: Array.from(signature)
        })
      })

      if (!response.ok) {
        throw new Error('Authentication failed')
      }

      const { token } = await response.json()
      return token
    } catch (error) {
      console.error('Authentication error:', error)
      return null
    }
  }, [publicKey, signMessage, connected])

  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || !connected || !publicKey) {
      return
    }

    updateState({ isConnecting: true, error: null })

    try {
      const token = await authenticateUser()
      if (!token) {
        throw new Error('Failed to authenticate')
      }

      const ws = new WebSocket(`${WEBSOCKET_URL}?token=${token}`)
      
      ws.onopen = () => {
        console.log('WebSocket connected')
        wsRef.current = ws
        reconnectAttemptsRef.current = 0
        updateState({ isConnecting: false })
        
        // Send queued messages
        while (messageQueueRef.current.length > 0) {
          const queuedMessage = messageQueueRef.current.shift()
          ws.send(JSON.stringify(queuedMessage))
        }

        // Join current room if set
        if (state.currentRoom) {
          ws.send(JSON.stringify({
            type: 'join_room',
            roomId: state.currentRoom
          }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        wsRef.current = null
        updateState({ isConnecting: false })

        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect()
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        updateState({ error: 'Connection error occurred', isConnecting: false })
      }

    } catch (error) {
      console.error('WebSocket connection failed:', error)
      updateState({ 
        error: error instanceof Error ? error.message : 'Failed to connect',
        isConnecting: false 
      })
      scheduleReconnect()
    }
  }, [connected, publicKey, authenticateUser, state.currentRoom, updateState])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectAttemptsRef.current++
    const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1)

    reconnectTimeoutRef.current = setTimeout(() => {
      if (connected && publicKey) {
        connectWebSocket()
      }
    }, delay)
  }, [connected, publicKey, connectWebSocket])

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'message':
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, data.message].sort((a, b) => a.timestamp - b.timestamp)
        }))
        break

      case 'message_edited':
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === data.messageId 
              ? { ...msg, content: data.content, edited: true, editedAt: data.editedAt }
              : msg
          )
        }))
        break

      case 'message_deleted':
        setState(prev => ({
          ...prev,
          messages: prev.messages.filter(msg => msg.id !== data.messageId)
        }))
        break

      case 'reaction_added':
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === data.messageId
              ? {
                  ...msg,
                  reactions: {
                    ...msg.reactions,
                    [data.reaction]: [...(msg.reactions?.[data.reaction] || []), data.userId]
                  }
                }
              : msg
          )
        }))
        break

      case 'user_typing':
        setState(prev => ({
          ...prev,
          typingUsers: {
            ...prev.typingUsers,
            [data.userId]: Date.now() + TYPING_TIMEOUT
          }
        }))
        break

      case 'room_joined':
        setState(prev => ({
          ...prev,
          currentRoom: data.roomId,
          messages: data.messages || []
        }))
        break

      case 'room_left':
        setState(prev => ({
          ...prev,
          currentRoom: prev.currentRoom === data.roomId ? null : prev.currentRoom
        }))
        break

      case 'rooms_updated':
        setState(prev => ({
          ...prev,
          rooms: data.rooms
        }))
        break

      case 'error':
        updateState({ error: data.message })
        toast.error(data.message)
        break

      default:
        console.log('Unknown message type:', data.type)
    }
  }, [updateState])

  const sendWebSocketMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    } else {
      messageQueueRef.current.push(message)
      return false
    }
  }, [])

  const sendMessage = useCallback(async (
    content: string, 
    type: 'text' | 'image' = 'text',
    replyTo?: string
  ): Promise<boolean> => {
    if (!content.trim() || !state.currentRoom || !publicKey) {
      return false
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      updateState({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` })
      return false
    }

    try {
      const messageData = {
        type: 'send_message',
        roomId: state.currentRoom,
        content: content.trim(),
        messageType: type,
        replyTo,
        timestamp: Date.now()
      }

      const success = sendWebSocketMessage(messageData)
      
      if (!success) {
        updateState({ error: 'Not connected to chat server' })
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to send message:', error)
      updateState({ error: 'Failed to send message' })
      return false
    }
  }, [state.currentRoom, publicKey, sendWebSocketMessage, updateState])

  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    if (!newContent.trim() || !state.currentRoom) {
      return false
    }

    try {
      const success = sendWebSocketMessage({
        type: 'edit_message',
        messageId,
        content: newContent.trim(),
        roomId: state.currentRoom
      })

      if (!success) {
        updateState({ error: 'Not connected to chat server' })
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to edit message:', error)
      updateState({ error: 'Failed to edit message' })
      return false
    }
  }, [state.currentRoom, sendWebSocketMessage, updateState])

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!state.currentRoom) {
      return false
    }

    try {
      const success = sendWebSocketMessage({
        type: 'delete_message',
        messageId,
        roomId: state.currentRoom
      })

      if (!success) {
        updateState({ error: 'Not connected to chat server' })
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to delete message:', error)
      updateState({ error: 'Failed to delete message' })
      return false
    }
  }, [state.currentRoom, sendWebSocketMessage, updateState])

  const reactToMessage = useCallback(async (messageId: string, reaction: string): Promise<boolean> => {
    if (!state.currentRoom) {
      return false
    }

    try {
      const success = sendWebSocketMessage({
        type: 'react_to_message',
        messageId,
        reaction,
        roomId: state.currentRoom
      })

      if (!success) {
        updateState({ error: 'Not connected to chat server' })
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to react to message:', error)
      updateState({ error: 'Failed to react to message' })
      return false
    }
  }, [state.currentRoom, sendWebSocketMessage, updateState])

  const joinRoom = useCallback(async (roomId: string): Promise<boolean> => {
    if (!roomId || !connected) {
      return false
    }

    try {
      const success = sendWebSocketMessage({
        type: 'join_room',
        roomId
      })

      if (!success) {
        updateState({ error: 'Not connected to chat server' })
        return false
      }

      updateState({ currentRoom: roomId })
      return true
    } catch (error) {
      console.error('Failed to join room:', error)
      updateState({ error: 'Failed to join room' })
      return false
    }
  }, [connected, sendWebSocketMessage, updateState])

  const leaveRoom = useCallback(async (roomId: string): Promise<boolean> => {
    if (!roomId) {
      return false
    }

    try {
      const success = sendWebSocketMessage({
        type: 'leave_room',
        roomId
      })

      if (!success) {
        updateState({ error: 'Not connected to chat server' })
        return false
      }

      if (state.currentRoom === roomId) {
        updateState({ currentRoom: null, messages: [] })
      }

      return true
    } catch (error) {
      console.error('Failed to leave room:', error)
      updateState({ error: 'Failed to leave room' })
      return false
    }
  }, [state.currentRoom, sendWebSocketMessage, updateState])

  const createRoom = useCallback(async (
    name: