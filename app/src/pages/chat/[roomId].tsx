```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { Send, Users, Lock, Crown, Settings, ArrowLeft, MoreVertical, Image, Smile, Paperclip } from 'lucide-react'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  userId: string
  username: string
  avatar: string
  content: string
  timestamp: number
  type: 'text' | 'image' | 'system'
  reactions?: { [emoji: string]: string[] }
}

interface ChatRoom {
  id: string
  name: string
  description: string
  creatorId: string
  creatorUsername: string
  keyPrice: number
  totalSupply: number
  memberCount: number
  isPrivate: boolean
  avatar: string
  createdAt: number
}

interface ChatMember {
  userId: string
  username: string
  avatar: string
  keyBalance: number
  joinedAt: number
  role: 'creator' | 'holder' | 'member'
}

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

export default function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const router = useRouter()
  const { publicKey, connected, signTransaction } = useWallet()
  const [roomId, setRoomId] = useState<string>('')
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<ChatMember[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [userKeyBalance, setUserKeyBalance] = useState(0)
  const [hasAccess, setHasAccess] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const connection = new Connection(SOLANA_RPC_URL)

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params
      setRoomId(resolvedParams.roomId)
    }
    resolveParams()
  }, [params])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const checkAccess = useCallback(async () => {
    if (!publicKey || !roomId) return false

    try {
      // Simulate checking user's key balance for this room
      const mockKeyBalance = Math.floor(Math.random() * 5)
      setUserKeyBalance(mockKeyBalance)
      
      // User has access if they own at least 1 key or are the creator
      const access = mockKeyBalance > 0 || room?.creatorId === publicKey.toString()
      setHasAccess(access)
      return access
    } catch (error) {
      console.error('Error checking access:', error)
      return false
    }
  }, [publicKey, roomId, room])

  const loadRoom = useCallback(async () => {
    if (!roomId) return

    try {
      setIsLoading(true)
      
      // Mock room data
      const mockRoom: ChatRoom = {
        id: roomId,
        name: `Room ${roomId.slice(0, 8)}`,
        description: 'Exclusive chat room for key holders',
        creatorId: 'creator123',
        creatorUsername: 'creator_user',
        keyPrice: 0.1,
        totalSupply: 100,
        memberCount: 42,
        isPrivate: true,
        avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${roomId}`,
        createdAt: Date.now() - 86400000
      }
      
      setRoom(mockRoom)
      
      // Mock members data
      const mockMembers: ChatMember[] = Array.from({ length: 10 }, (_, i) => ({
        userId: `user${i}`,
        username: `user${i}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`,
        keyBalance: Math.floor(Math.random() * 10) + 1,
        joinedAt: Date.now() - Math.random() * 86400000,
        role: i === 0 ? 'creator' : Math.random() > 0.7 ? 'holder' : 'member'
      }))
      
      setMembers(mockMembers)
      
      // Mock messages data
      const mockMessages: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg${i}`,
        userId: `user${Math.floor(Math.random() * 5)}`,
        username: `user${Math.floor(Math.random() * 5)}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${Math.floor(Math.random() * 5)}`,
        content: `This is message ${i + 1} in the chat room`,
        timestamp: Date.now() - (20 - i) * 60000,
        type: 'text',
        reactions: Math.random() > 0.7 ? { '👍': ['user1', 'user2'], '🔥': ['user3'] } : undefined
      }))
      
      setMessages(mockMessages)
    } catch (error) {
      console.error('Error loading room:', error)
      toast.error('Failed to load chat room')
    } finally {
      setIsLoading(false)
    }
  }, [roomId])

  const sendMessage = async () => {
    if (!newMessage.trim() || !publicKey || !connected || isSending) return

    try {
      setIsSending(true)
      
      const message: ChatMessage = {
        id: `msg_${Date.now()}`,
        userId: publicKey.toString(),
        username: publicKey.toString().slice(0, 8),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${publicKey.toString()}`,
        content: newMessage.trim(),
        timestamp: Date.now(),
        type: 'text'
      }
      
      setMessages(prev => [...prev, message])
      setNewMessage('')
      
      // Simulate sending to blockchain/backend
      await new Promise(resolve => setTimeout(resolve, 500))
      
      toast.success('Message sent!')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const buyKeys = async () => {
    if (!publicKey || !connected || !room) return

    try {
      toast.info('Preparing transaction...')
      
      // Simulate key purchase transaction
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setUserKeyBalance(prev => prev + 1)
      setHasAccess(true)
      toast.success('Keys purchased successfully!')
    } catch (error) {
      console.error('Error buying keys:', error)
      toast.error('Failed to purchase keys')
    }
  }

  const addReaction = (messageId: string, emoji: string) => {
    if (!publicKey) return

    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = { ...msg.reactions }
        if (!reactions[emoji]) {
          reactions[emoji] = []
        }
        
        const userId = publicKey.toString()
        if (reactions[emoji].includes(userId)) {
          reactions[emoji] = reactions[emoji].filter(id => id !== userId)
          if (reactions[emoji].length === 0) {
            delete reactions[emoji]
          }
        } else {
          reactions[emoji].push(userId)
        }
        
        return { ...msg, reactions }
      }
      return msg
    }))
  }

  useEffect(() => {
    if (roomId) {
      loadRoom()
    }
  }, [roomId, loadRoom])

  useEffect(() => {
    if (room && publicKey) {
      checkAccess()
    }
  }, [room, publicKey, checkAccess])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Room Not Found</h1>
          <button
            onClick={() => router.push('/chat')}
            className="px-6 py-2 bg-green-500 text-black rounded-lg font-medium hover:bg-green-400 transition-colors"
          >
            Back to Chat
          </button>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Connect Wallet</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to access this chat room</p>
          <button
            onClick={() => router.push('/chat')}
            className="px-6 py-2 bg-green-500 text-black rounded-lg font-medium hover:bg-green-400 transition-colors"
          >
            Back to Chat
          </button>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="relative mb-6">
            <img
              src={room.avatar}
              alt={room.name}
              className="w-24 h-24 rounded-full mx-auto border-2 border-gray-700"
            />
            <Lock className="absolute -bottom-2 -right-2 h-8 w-8 text-yellow-500 bg-black rounded-full p-1" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">{room.name}</h1>
          <p className="text-gray-400 mb-6">{room.description}</p>
          
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Key Price</span>
              <span className="text-white font-medium">{room.keyPrice} SOL</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Total Supply</span>
              <span className="text-white font-medium">{room.totalSupply}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Members</span>
              <span className="text-white font-medium">{room.memberCount}</span>
            </div>
          </div>
          
          <button
            onClick={buyKeys}
            className="w-full px-6 py-3 bg-green-500 text-black rounded-lg font-medium hover:bg-green-400 transition-colors mb-4"
          >
            Buy Keys to Join
          </button>
          
          <button
            onClick={() => router.push('/chat')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Back to Chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/chat')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors lg:hidden"
            >
              <ArrowLeft className="h-5 w-5 text-gray-400" />
            </button>
            
            <img
              src={room.avatar}
              alt={room.name}
              className="w-10 h-10 rounded-full border border-gray-700"
            />
            
            <div>
              <h1 className="text-white font-semibold">{room.name}</h1>
              <p className="text-sm text-gray-400">{room.memberCount} members</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Users className="h-5 w-5 text-gray-400" />
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex space-x-3">
                <img
                  src={message.avatar}
                  alt={message.username}
                  className="w-8 h-8 rounded-full border border-gray-700 flex-shrink-0"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {message.username}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>