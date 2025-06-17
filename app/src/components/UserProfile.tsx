```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  Key, 
  TrendingUp, 
  TrendingDown, 
  MessageCircle, 
  Users, 
  Star,
  Copy,
  ExternalLink,
  Settings,
  Shield,
  Zap,
  Crown,
  Award
} from 'lucide-react'

interface UserStats {
  keyPrice: number
  keyHolders: number
  totalVolume: number
  reputation: number
  followers: number
  following: number
  posts: number
  keysOwned: number
}

interface UserData {
  publicKey: string
  username: string
  displayName: string
  bio: string
  avatar: string
  banner: string
  verified: boolean
  createdAt: number
  stats: UserStats
  isOnline: boolean
  lastSeen: number
}

interface KeyTransaction {
  id: string
  type: 'buy' | 'sell'
  amount: number
  price: number
  timestamp: number
  buyer?: string
  seller?: string
}

interface UserProfileProps {
  userAddress: string
  isOwnProfile?: boolean
  onClose?: () => void
}

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

export default function UserProfile({ userAddress, isOwnProfile = false, onClose }: UserProfileProps) {
  const { publicKey, connected, signTransaction } = useWallet()
  const [connection] = useState(() => new Connection(SOLANA_RPC_URL, 'confirmed'))
  
  const [userData, setUserData] = useState<UserData | null>(null)
  const [keyTransactions, setKeyTransactions] = useState<KeyTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'activity'>('overview')
  const [keyAmount, setKeyAmount] = useState(1)
  const [isTrading, setIsTrading] = useState(false)
  const [userBalance, setUserBalance] = useState(0)
  const [priceHistory, setPriceHistory] = useState<number[]>([])

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Validate address
      try {
        new PublicKey(userAddress)
      } catch {
        throw new Error('Invalid user address')
      }

      // Simulate API call - replace with actual backend integration
      const mockUserData: UserData = {
        publicKey: userAddress,
        username: `user_${userAddress.slice(0, 8)}`,
        displayName: 'Solana Creator',
        bio: 'Building the future of decentralized social media on Solana',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userAddress}`,
        banner: '/api/placeholder/800/200',
        verified: Math.random() > 0.7,
        createdAt: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
        stats: {
          keyPrice: 0.1 + Math.random() * 2,
          keyHolders: Math.floor(Math.random() * 1000) + 10,
          totalVolume: Math.random() * 10000,
          reputation: Math.floor(Math.random() * 1000),
          followers: Math.floor(Math.random() * 5000),
          following: Math.floor(Math.random() * 1000),
          posts: Math.floor(Math.random() * 500),
          keysOwned: Math.floor(Math.random() * 50)
        },
        isOnline: Math.random() > 0.5,
        lastSeen: Date.now() - Math.random() * 24 * 60 * 60 * 1000
      }

      setUserData(mockUserData)

      // Generate mock price history
      const history = Array.from({ length: 30 }, (_, i) => {
        const basePrice = mockUserData.stats.keyPrice
        const variation = (Math.random() - 0.5) * 0.2
        return Math.max(0.01, basePrice + variation)
      })
      setPriceHistory(history)

      // Generate mock transactions
      const transactions: KeyTransaction[] = Array.from({ length: 10 }, (_, i) => ({
        id: `tx_${i}`,
        type: Math.random() > 0.5 ? 'buy' : 'sell',
        amount: Math.floor(Math.random() * 5) + 1,
        price: mockUserData.stats.keyPrice + (Math.random() - 0.5) * 0.1,
        timestamp: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
        buyer: Math.random() > 0.5 ? 'buyer_address' : undefined,
        seller: Math.random() > 0.5 ? 'seller_address' : undefined
      }))
      setKeyTransactions(transactions)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user data')
      console.error('Error fetching user data:', err)
    } finally {
      setLoading(false)
    }
  }, [userAddress])

  const fetchUserBalance = useCallback(async () => {
    if (!publicKey || !connected) return

    try {
      const balance = await connection.getBalance(publicKey)
      setUserBalance(balance / LAMPORTS_PER_SOL)
    } catch (err) {
      console.error('Error fetching balance:', err)
    }
  }, [connection, publicKey, connected])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  useEffect(() => {
    if (connected) {
      fetchUserBalance()
    }
  }, [connected, fetchUserBalance])

  const handleTradeKey = async (action: 'buy' | 'sell') => {
    if (!connected || !publicKey || !userData || !signTransaction) {
      toast.error('Please connect your wallet')
      return
    }

    if (keyAmount <= 0) {
      toast.error('Invalid key amount')
      return
    }

    const totalCost = userData.stats.keyPrice * keyAmount
    if (action === 'buy' && userBalance < totalCost) {
      toast.error('Insufficient balance')
      return
    }

    try {
      setIsTrading(true)

      // Simulate transaction - replace with actual Solana program interaction
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Update local state
      setUserData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          stats: {
            ...prev.stats,
            keyHolders: action === 'buy' 
              ? prev.stats.keyHolders + 1 
              : Math.max(0, prev.stats.keyHolders - 1),
            totalVolume: prev.stats.totalVolume + totalCost
          }
        }
      })

      // Add transaction to history
      const newTransaction: KeyTransaction = {
        id: `tx_${Date.now()}`,
        type: action,
        amount: keyAmount,
        price: userData.stats.keyPrice,
        timestamp: Date.now(),
        [action === 'buy' ? 'buyer' : 'seller']: publicKey.toString()
      }
      setKeyTransactions(prev => [newTransaction, ...prev])

      toast.success(`Successfully ${action === 'buy' ? 'bought' : 'sold'} ${keyAmount} key${keyAmount > 1 ? 's' : ''}`)
      setKeyAmount(1)
      
      // Refresh balance
      await fetchUserBalance()

    } catch (err) {
      toast.error(`Failed to ${action} keys`)
      console.error(`Error ${action}ing keys:`, err)
    } finally {
      setIsTrading(false)
    }
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(userAddress)
    toast.success('Address copied to clipboard')
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
            <User className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold">Profile Not Found</h2>
          <p className="text-gray-400">{error || 'User profile could not be loaded'}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    )
  }

  const priceChange = priceHistory.length > 1 
    ? ((priceHistory[priceHistory.length - 1] - priceHistory[priceHistory.length - 2]) / priceHistory[priceHistory.length - 2]) * 100
    : 0

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="relative">
        {/* Banner */}
        <div className="h-48 md:h-64 bg-gradient-to-r from-purple-900 via-blue-900 to-purple-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="text-xl">×</span>
            </button>
          )}
        </div>

        {/* Profile Info */}
        <div className="relative px-4 md:px-8 -mt-16">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-black bg-gray-800 overflow-hidden">
                <img
                  src={userData.avatar}
                  alt={userData.displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userAddress}`
                  }}
                />
              </div>
              {userData.isOnline && (
                <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-black" />
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 mt-4 md:mt-0 md:mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{userData.displayName}</h1>
                {userData.verified && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <p className="text-gray-400 mb-2">@{userData.username}</p>
              <div className="flex items-center space-x-2 text-sm text-gray-400 mb-3">
                <button
                  onClick={copyAddress}
                  className="flex items-center space-x-1 hover:text-white transition-colors"
                >
                  <span>{formatAddress(userData.publicKey)}</span>
                  <Copy className="w-3 h-3" />
                </button>
                <span>•</span>
                <span>Joined {formatTimeAgo(userData.createdAt)}</span>
                {!userData.isOnline && (
                  <>
                    <span>•</span>
                    <span>Last seen {formatTimeAgo(userData.lastSeen)}</span>
                  </>
                )}
              </div>
              <p className="text-gray-300 max-w-2xl">{userData.bio}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-4 md:mt-0 md:mb-4">
              {!isOwnProfile && (
                <>
                  <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Message</span>
                  </button>
                  <button className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                    Follow
                  </button>
                </>
              )}