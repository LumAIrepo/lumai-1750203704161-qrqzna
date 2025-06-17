```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  MessageCircle, 
  Users, 
  TrendingUp, 
  Star, 
  Copy, 
  ExternalLink,
  Settings,
  Shield,
  Zap,
  Heart,
  Share2,
  MoreHorizontal,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Verified
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface UserProfile {
  address: string
  username: string
  displayName: string
  bio: string
  avatar: string
  banner: string
  verified: boolean
  joinedAt: Date
  location?: string
  website?: string
  followers: number
  following: number
  keyHolders: number
  keyPrice: number
  totalVolume: number
  reputation: number
  level: number
  badges: string[]
  isOnline: boolean
  lastSeen: Date
}

interface Post {
  id: string
  author: string
  content: string
  timestamp: Date
  likes: number
  comments: number
  shares: number
  isLiked: boolean
  isBookmarked: boolean
  tokenWeight: number
  media?: {
    type: 'image' | 'video'
    url: string
  }[]
}

interface KeyTransaction {
  id: string
  type: 'buy' | 'sell'
  buyer: string
  seller: string
  amount: number
  price: number
  timestamp: Date
  txHash: string
}

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const router = useRouter()
  const { publicKey, connected } = useWallet()
  const [resolvedParams, setResolvedParams] = useState<{ address: string } | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [keyTransactions, setKeyTransactions] = useState<KeyTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [ownsKeys, setOwnsKeys] = useState(0)
  const [keyPrice, setKeyPrice] = useState(0)
  const [priceChange, setPriceChange] = useState(0)

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  const isOwnProfile = useMemo(() => {
    return connected && publicKey && resolvedParams && publicKey.toString() === resolvedParams.address
  }, [connected, publicKey, resolvedParams])

  useEffect(() => {
    if (!resolvedParams?.address) return

    const fetchProfile = async () => {
      try {
        setLoading(true)
        setError(null)

        // Validate address
        try {
          new PublicKey(resolvedParams.address)
        } catch {
          setError('Invalid wallet address')
          return
        }

        // Simulate API calls - replace with actual API endpoints
        const [profileRes, postsRes, transactionsRes] = await Promise.all([
          fetch(`/api/users/${resolvedParams.address}`),
          fetch(`/api/users/${resolvedParams.address}/posts`),
          fetch(`/api/users/${resolvedParams.address}/key-transactions`)
        ])

        if (!profileRes.ok) {
          if (profileRes.status === 404) {
            setError('User not found')
          } else {
            setError('Failed to load profile')
          }
          return
        }

        const profileData = await profileRes.json()
        const postsData = postsRes.ok ? await postsRes.json() : []
        const transactionsData = transactionsRes.ok ? await transactionsRes.json() : []

        setProfile({
          ...profileData,
          joinedAt: new Date(profileData.joinedAt),
          lastSeen: new Date(profileData.lastSeen)
        })
        setPosts(postsData.map((post: any) => ({
          ...post,
          timestamp: new Date(post.timestamp)
        })))
        setKeyTransactions(transactionsData.map((tx: any) => ({
          ...tx,
          timestamp: new Date(tx.timestamp)
        })))

        // Check if current user follows this profile
        if (connected && publicKey) {
          const followRes = await fetch(`/api/users/${publicKey.toString()}/following/${resolvedParams.address}`)
          setIsFollowing(followRes.ok)

          // Check key ownership
          const keysRes = await fetch(`/api/users/${publicKey.toString()}/keys/${resolvedParams.address}`)
          if (keysRes.ok) {
            const keysData = await keysRes.json()
            setOwnsKeys(keysData.amount || 0)
          }
        }

        // Get current key price
        const priceRes = await fetch(`/api/keys/${resolvedParams.address}/price`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          setKeyPrice(priceData.price)
          setPriceChange(priceData.change24h)
        }

      } catch (err) {
        console.error('Error fetching profile:', err)
        setError('Failed to load profile data')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [resolvedParams, connected, publicKey])

  const handleFollow = async () => {
    if (!connected || !publicKey || !profile) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const method = isFollowing ? 'DELETE' : 'POST'
      const res = await fetch(`/api/users/${publicKey.toString()}/following/${profile.address}`, {
        method
      })

      if (res.ok) {
        setIsFollowing(!isFollowing)
        setProfile(prev => prev ? {
          ...prev,
          followers: prev.followers + (isFollowing ? -1 : 1)
        } : null)
        toast.success(isFollowing ? 'Unfollowed' : 'Following')
      } else {
        toast.error('Failed to update follow status')
      }
    } catch (err) {
      console.error('Error updating follow:', err)
      toast.error('Failed to update follow status')
    }
  }

  const handleBuyKey = async () => {
    if (!connected || !publicKey || !profile) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      // Implement key purchase logic
      toast.success('Key purchase initiated')
    } catch (err) {
      console.error('Error buying key:', err)
      toast.error('Failed to buy key')
    }
  }

  const handleSellKey = async () => {
    if (!connected || !publicKey || !profile || ownsKeys === 0) {
      toast.error('No keys to sell')
      return
    }

    try {
      // Implement key selling logic
      toast.success('Key sale initiated')
    } catch (err) {
      console.error('Error selling key:', err)
      toast.error('Failed to sell key')
    }
  }

  const copyAddress = () => {
    if (profile) {
      navigator.clipboard.writeText(profile.address)
      toast.success('Address copied to clipboard')
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatPrice = (price: number) => {
    return `${price.toFixed(4)} SOL`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-48 bg-gray-800 rounded-lg"></div>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 bg-gray-800 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-800 rounded w-48"></div>
                <div className="h-4 bg-gray-800 rounded w-32"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-400">
            {error || 'Profile not found'}
          </h1>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Banner */}
        <div className="relative h-48 bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg overflow-hidden mb-6">
          {profile.banner && (
            <img 
              src={profile.banner} 
              alt="Profile banner" 
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* Profile Header */}
        <div className="relative -mt-16 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-black">
                <AvatarImage src={profile.avatar} alt={profile.displayName} />
                <AvatarFallback className="bg-gray-800 text-2xl">
                  {profile.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {profile.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 border-black rounded-full"></div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                {profile.verified && (
                  <Verified className="w-6 h-6 text-blue-400 fill-current" />
                )}
                <Badge variant="secondary" className="bg-purple-900/50">
                  Level {profile.level}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-gray-400">
                <span>@{profile.username}</span>
                <button onClick={copyAddress} className="hover:text-white transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {profile.bio && (
                <p className="text-gray-300 max-w-md">{profile.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {formatDistanceToNow(profile.joinedAt)} ago</span>
                </div>
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <a 
                    href={profile.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Website</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {!isOwnProfile && (
                <>
                  <Button
                    onClick={handleFollow}
                    variant={isFollowing ? "outline" : "default"}
                    className={isFollowing ? "border-gray-600" : "bg-purple-600 hover:bg-purple-700"}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Button>
                  
                  {ownsKeys > 0 ? (
                    <Button onClick={handleSellKey} variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/10">
                      Sell Keys ({ownsKeys})
                    </Button>
                  ) : (
                    <Button onClick={handleBuyKey} className="bg-green-600 hover:bg-green-700">
                      Buy Key ({formatPrice(keyPrice)})
                    </Button>
                  )}
                </>
              )}
              
              {isOwnProfile && (
                <Button variant="outline" onClick={() => router.push('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{formatNumber(profile.followers)}</div>