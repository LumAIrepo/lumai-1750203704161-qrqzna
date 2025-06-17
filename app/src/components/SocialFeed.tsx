'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Heart, MessageCircle, Share2, TrendingUp, Users, Zap, Crown, Star, MoreHorizontal, Eye, Lock } from 'lucide-react'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'

interface UserProfile {
  publicKey: string
  username: string
  displayName: string
  avatar: string
  verified: boolean
  keyPrice: number
  keyHolders: number
  totalVolume: number
  reputation: number
  isInfluencer: boolean
}

interface SocialPost {
  id: string
  author: UserProfile
  content: string
  timestamp: number
  likes: number
  comments: number
  shares: number
  views: number
  isLiked: boolean
  isBookmarked: boolean
  tokenWeight: number
  isGated: boolean
  requiredKeys: number
  media?: {
    type: 'image' | 'video'
    url: string
    thumbnail?: string
  }[]
  engagement: {
    totalValue: number
    topSupporters: UserProfile[]
  }
}

interface FeedFilters {
  type: 'all' | 'following' | 'trending' | 'gated'
  timeframe: '1h' | '24h' | '7d' | '30d'
  minKeyPrice: number
  sortBy: 'recent' | 'engagement' | 'value'
}

const MOCK_POSTS: SocialPost[] = [
  {
    id: '1',
    author: {
      publicKey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      username: 'cryptoking',
      displayName: 'Crypto King 👑',
      avatar: '/api/placeholder/40/40',
      verified: true,
      keyPrice: 0.25,
      keyHolders: 1247,
      totalVolume: 156.7,
      reputation: 9.2,
      isInfluencer: true
    },
    content: 'Just launched my new trading strategy! 🚀 My key holders get exclusive access to all my alpha calls. The last 3 calls were all 10x+ 📈\n\n#SolanaAlpha #TradingSignals',
    timestamp: Date.now() - 1800000,
    likes: 342,
    comments: 89,
    shares: 156,
    views: 2847,
    isLiked: false,
    isBookmarked: false,
    tokenWeight: 8.5,
    isGated: true,
    requiredKeys: 1,
    engagement: {
      totalValue: 12.4,
      topSupporters: []
    }
  },
  {
    id: '2',
    author: {
      publicKey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      username: 'nftartist',
      displayName: 'Digital Dreams',
      avatar: '/api/placeholder/40/40',
      verified: false,
      keyPrice: 0.08,
      keyHolders: 423,
      totalVolume: 34.2,
      reputation: 7.8,
      isInfluencer: false
    },
    content: 'New NFT collection dropping tomorrow! 🎨 Each piece tells a story of the decentralized future. Key holders get whitelist access and 50% discount.',
    timestamp: Date.now() - 3600000,
    likes: 156,
    comments: 34,
    shares: 67,
    views: 1234,
    isLiked: true,
    isBookmarked: false,
    tokenWeight: 6.2,
    isGated: false,
    requiredKeys: 0,
    media: [
      {
        type: 'image',
        url: '/api/placeholder/500/300'
      }
    ],
    engagement: {
      totalValue: 5.8,
      topSupporters: []
    }
  }
]

export default function SocialFeed() {
  const { publicKey, connected } = useWallet()
  const [posts, setPosts] = useState<SocialPost[]>(MOCK_POSTS)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FeedFilters>({
    type: 'all',
    timeframe: '24h',
    minKeyPrice: 0,
    sortBy: 'recent'
  })
  const [userKeys, setUserKeys] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  const filteredPosts = useMemo(() => {
    let filtered = [...posts]

    // Filter by type
    if (filters.type === 'gated') {
      filtered = filtered.filter(post => post.isGated)
    } else if (filters.type === 'trending') {
      filtered = filtered.filter(post => post.tokenWeight > 7)
    }

    // Filter by minimum key price
    if (filters.minKeyPrice > 0) {
      filtered = filtered.filter(post => post.author.keyPrice >= filters.minKeyPrice)
    }

    // Sort posts
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'engagement':
          return (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares)
        case 'value':
          return b.engagement.totalValue - a.engagement.totalValue
        default:
          return b.timestamp - a.timestamp
      }
    })

    return filtered
  }, [posts, filters])

  const handleLike = useCallback(async (postId: string) => {
    if (!connected || !publicKey) return

    try {
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            isLiked: !post.isLiked
          }
        }
        return post
      }))
    } catch (error) {
      console.error('Error liking post:', error)
    }
  }, [connected, publicKey])

  const handleShare = useCallback(async (postId: string) => {
    try {
      const post = posts.find(p => p.id === postId)
      if (!post) return

      await navigator.share({
        title: `${post.author.displayName} on SolSocial`,
        text: post.content.slice(0, 100) + '...',
        url: `${window.location.origin}/post/${postId}`
      })

      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, shares: p.shares + 1 } : p
      ))
    } catch (error) {
      console.error('Error sharing post:', error)
    }
  }, [posts])

  const handleBuyKey = useCallback(async (authorKey: string) => {
    if (!connected || !publicKey) return

    try {
      // Simulate key purchase
      setUserKeys(prev => new Set([...prev, authorKey]))
    } catch (error) {
      console.error('Error buying key:', error)
    }
  }, [connected, publicKey])

  const refreshFeed = useCallback(async () => {
    setRefreshing(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      // In real app, fetch new posts from API
    } catch (error) {
      console.error('Error refreshing feed:', error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatPrice = (price: number): string => {
    return `${price.toFixed(3)} SOL`
  }

  const canViewPost = (post: SocialPost): boolean => {
    if (!post.isGated) return true
    return userKeys.has(post.author.publicKey)
  }

  useEffect(() => {
    refreshFeed()
  }, [refreshFeed])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Feed Filters */}
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'following', 'trending', 'gated'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilters(prev => ({ ...prev, type }))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filters.type === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {type === 'all' && 'All'}
                {type === 'following' && 'Following'}
                {type === 'trending' && 'Trending'}
                {type === 'gated' && 'Gated'}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="recent">Recent</option>
              <option value="engagement">Engagement</option>
              <option value="value">Value</option>
            </select>

            <button
              onClick={refreshFeed}
              disabled={refreshing}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <TrendingUp className={`w-4 h-4 text-gray-300 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-6">
        {filteredPosts.map((post) => {
          const canView = canViewPost(post)
          
          return (
            <div
              key={post.id}
              className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all"
            >
              {/* Post Header */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Image
                        src={post.author.avatar}
                        alt={post.author.displayName}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                      {post.author.isInfluencer && (
                        <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{post.author.displayName}</h3>
                        {post.author.verified && (
                          <Star className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>@{post.author.username}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(post.timestamp)} ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {post.isGated && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 rounded-lg">
                        <Lock className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-purple-400">Gated</span>
                      </div>
                    )}
                    
                    <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Key Info */}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Key Price:</span>
                    <span className="text-green-400 font-medium">{formatPrice(post.author.keyPrice)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">{formatNumber(post.author.keyHolders)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-500" />
                    <span className="text-yellow-400">{post.tokenWeight.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div className="p-4">
                {canView ? (
                  <>
                    <p className="text-gray-100 whitespace-pre-wrap mb-4">{post.content}</p>
                    
                    {post.media && post.media.length > 0 && (
                      <div className="mb-4 rounded-lg overflow-hidden">
                        {post.media.map((media, index) => (
                          <div key={index} className="relative">
                            {media.type === 'image' && (
                              <Image
                                src={media.url}
                                alt="Post media"
                                width={500}
                                height={300}
                                className="w-full h-auto"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Lock