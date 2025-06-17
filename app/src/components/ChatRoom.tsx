'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Send, Users, Lock, Crown, Verified, MoreVertical, Image, Smile, Paperclip } from 'lucide-react'
import { toast } from 'sonner'

interface Message {
  id: string
  userId: string
  username: string
  userAvatar?: string
  content: string
  timestamp: number
  type: 'text' | 'image' | 'system'
  isOwner?: boolean
  keyBalance?: number
}

interface ChatUser {
  id: string
  username: string
  avatar?: string
  keyBalance: number
  isOwner: boolean
  lastSeen: number
  isOnline: boolean
}

interface ChatRoomProps {
  roomId: string
  roomName: string
  roomOwner: string
  requiredKeyBalance: number
  onClose: () => void
}

export default function ChatRoom({ 
  roomId, 
  roomName, 
  roomOwner, 
  requiredKeyBalance, 
  onClose 
}: ChatRoomProps) {
  const { publicKey, connected } = useWallet()
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<ChatUser[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [userKeyBalance, setUserKeyBalance] = useState(0)
  const [hasAccess, setHasAccess] = useState(false)
  const [showUserList, setShowUserList] = useState(false)
  const [isTyping, setIsTyping] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const checkAccess = useCallback(async () => {
    if (!publicKey || !connected) {
      setHasAccess(false)
      return
    }

    try {
      // Simulate checking user's key balance for this room
      const balance = Math.floor(Math.random() * 10) + 1
      setUserKeyBalance(balance)
      setHasAccess(balance >= requiredKeyBalance)
    } catch (error) {
      console.error('Error checking access:', error)
      setHasAccess(false)
    }
  }, [publicKey, connected, requiredKeyBalance])

  const loadMessages = useCallback(async () => {
    if (!hasAccess) return

    try {
      setIsLoading(true)
      
      // Simulate loading messages
      const mockMessages: Message[] = [
        {
          id: '1',
          userId: roomOwner,
          username: 'RoomOwner',
          content: `Welcome to ${roomName}! 🎉`,
          timestamp: Date.now() - 3600000,
          type: 'text',
          isOwner: true,
          keyBalance: 100
        },
        {
          id: '2',
          userId: 'user2',
          username: 'CryptoTrader',
          content: 'Great to be here! Love the exclusive access 🔥',
          timestamp: Date.now() - 1800000,
          type: 'text',
          keyBalance: 5
        },
        {
          id: '3',
          userId: 'system',
          username: 'System',
          content: 'User @NewMember joined the chat',
          timestamp: Date.now() - 900000,
          type: 'system'
        }
      ]

      setMessages(mockMessages)
      
      // Simulate loading users
      const mockUsers: ChatUser[] = [
        {
          id: roomOwner,
          username: 'RoomOwner',
          keyBalance: 100,
          isOwner: true,
          lastSeen: Date.now(),
          isOnline: true
        },
        {
          id: 'user2',
          username: 'CryptoTrader',
          keyBalance: 5,
          isOwner: false,
          lastSeen: Date.now() - 300000,
          isOnline: true
        },
        {
          id: 'user3',
          username: 'DeFiWhale',
          keyBalance: 25,
          isOwner: false,
          lastSeen: Date.now() - 600000,
          isOnline: false
        }
      ]

      setUsers(mockUsers)
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Failed to load messages')
    } finally {
      setIsLoading(false)
    }
  }, [hasAccess, roomName, roomOwner])

  const sendMessage = async () => {
    if (!newMessage.trim() || !publicKey || !hasAccess || isSending) return

    try {
      setIsSending(true)
      
      const message: Message = {
        id: Date.now().toString(),
        userId: publicKey.toString(),
        username: 'You',
        content: newMessage.trim(),
        timestamp: Date.now(),
        type: 'text',
        keyBalance: userKeyBalance
      }

      setMessages(prev => [...prev, message])
      setNewMessage('')
      
      // Simulate sending to backend
      await new Promise(resolve => setTimeout(resolve, 500))
      
      toast.success('Message sent!')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatKeyBalance = (balance: number) => {
    return balance >= 1000 ? `${(balance / 1000).toFixed(1)}K` : balance.toString()
  }

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  useEffect(() => {
    if (hasAccess) {
      loadMessages()
    }
  }, [hasAccess, loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (hasAccess && inputRef.current) {
      inputRef.current.focus()
    }
  }, [hasAccess])

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Wallet Required</h3>
          <p className="text-gray-400">Connect your wallet to access this chat room</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <Lock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Premium Access Required</h3>
          <p className="text-gray-400 mb-4">
            You need at least {requiredKeyBalance} keys to access this chat room
          </p>
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-300">Your current balance:</p>
            <p className="text-2xl font-bold text-white">{userKeyBalance} keys</p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Buy More Keys
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
          </div>
          <div>
            <h2 className="font-bold text-white flex items-center space-x-2">
              <span>{roomName}</span>
              <Crown className="w-4 h-4 text-yellow-500" />
            </h2>
            <p className="text-sm text-gray-400">
              {users.filter(u => u.isOnline).length} online • {requiredKeyBalance} keys required
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowUserList(!showUserList)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors relative"
          >
            <Users className="w-5 h-5 text-gray-400" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-xs text-white rounded-full flex items-center justify-center">
              {users.length}
            </span>
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.type === 'system' ? 'justify-center' : ''
                  }`}
                >
                  {message.type === 'system' ? (
                    <div className="text-sm text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                      {message.content}
                    </div>
                  ) : (
                    <>
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {message.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {message.isOwner && (
                          <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-white">
                            {message.username}
                          </span>
                          {message.isOwner && (
                            <Verified className="w-4 h-4 text-blue-500" />
                          )}
                          {message.keyBalance && (
                            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                              {formatKeyBalance(message.keyBalance)} keys
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        
                        <div className="bg-gray-800 rounded-lg px-3 py-2 max-w-md">
                          <p className="text-gray-200 break-words">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              
              {isTyping.length > 0 && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm">
                    {isTyping.join(', ')} {isTyping.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Message Input */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <Paperclip className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <Image className="w-5 h-5 text-gray-400" />
              </button>
              
              <div className="flex-1 relative">