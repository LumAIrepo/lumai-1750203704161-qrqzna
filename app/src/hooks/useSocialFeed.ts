```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Connection } from '@solana/web3.js'
import { Program, AnchorProvider, web3, BN } from '@project-serum/anchor'
import { toast } from 'sonner'

export interface SocialPost {
  id: string
  author: PublicKey
  authorUsername: string
  authorAvatar?: string
  content: string
  timestamp: number
  likes: number
  comments: number
  shares: number
  tokenWeight: number
  keyPrice: number
  isLiked: boolean
  isBookmarked: boolean
  media?: {
    type: 'image' | 'video'
    url: string
    thumbnail?: string
  }[]
  tags: string[]
  engagement: {
    impressions: number
    clicks: number
    engagementRate: number
  }
}

export interface SocialFeedFilters {
  following?: boolean
  trending?: boolean
  recent?: boolean
  tokenGated?: boolean
  minKeyPrice?: number
  tags?: string[]
  timeRange?: '1h' | '24h' | '7d' | '30d' | 'all'
}

export interface SocialFeedState {
  posts: SocialPost[]
  loading: boolean
  error: string | null
  hasMore: boolean
  refreshing: boolean
  filters: SocialFeedFilters
  totalPosts: number
  lastFetchTime: number
}

export interface UseSocialFeedReturn {
  posts: SocialPost[]
  loading: boolean
  error: string | null
  hasMore: boolean
  refreshing: boolean
  filters: SocialFeedFilters
  totalPosts: number
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  updateFilters: (filters: Partial<SocialFeedFilters>) => void
  likePost: (postId: string) => Promise<void>
  unlikePost: (postId: string) => Promise<void>
  bookmarkPost: (postId: string) => Promise<void>
  unbookmarkPost: (postId: string) => Promise<void>
  sharePost: (postId: string) => Promise<void>
  reportPost: (postId: string, reason: string) => Promise<void>
  clearError: () => void
}

const POSTS_PER_PAGE = 20
const REFRESH_INTERVAL = 30000 // 30 seconds
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

export function useSocialFeed(initialFilters: SocialFeedFilters = {}): UseSocialFeedReturn {
  const { connection } = useConnection()
  const { publicKey, signTransaction } = useWallet()
  
  const [state, setState] = useState<SocialFeedState>({
    posts: [],
    loading: true,
    error: null,
    hasMore: true,
    refreshing: false,
    filters: { recent: true, ...initialFilters },
    totalPosts: 0,
    lastFetchTime: 0
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchPosts = useCallback(async (
    offset: number = 0,
    limit: number = POSTS_PER_PAGE,
    isRefresh: boolean = false
  ): Promise<{ posts: SocialPost[], hasMore: boolean, total: number }> => {
    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      abortControllerRef.current = new AbortController()
      
      const queryParams = new URLSearchParams({
        offset: offset.toString(),
        limit: limit.toString(),
        ...(state.filters.following && { following: 'true' }),
        ...(state.filters.trending && { trending: 'true' }),
        ...(state.filters.recent && { recent: 'true' }),
        ...(state.filters.tokenGated && { tokenGated: 'true' }),
        ...(state.filters.minKeyPrice && { minKeyPrice: state.filters.minKeyPrice.toString() }),
        ...(state.filters.timeRange && { timeRange: state.filters.timeRange }),
        ...(state.filters.tags?.length && { tags: state.filters.tags.join(',') }),
        ...(publicKey && { userPubkey: publicKey.toString() })
      })

      const response = await fetch(`/api/social/feed?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch posts')
      }

      const posts: SocialPost[] = data.posts.map((post: any) => ({
        id: post.id,
        author: new PublicKey(post.author),
        authorUsername: post.authorUsername,
        authorAvatar: post.authorAvatar,
        content: post.content,
        timestamp: post.timestamp,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        tokenWeight: post.tokenWeight || 0,
        keyPrice: post.keyPrice || 0,
        isLiked: post.isLiked || false,
        isBookmarked: post.isBookmarked || false,
        media: post.media || [],
        tags: post.tags || [],
        engagement: {
          impressions: post.engagement?.impressions || 0,
          clicks: post.engagement?.clicks || 0,
          engagementRate: post.engagement?.engagementRate || 0
        }
      }))

      return {
        posts,
        hasMore: data.hasMore || false,
        total: data.total || 0
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error
      }
      
      console.error('Error fetching posts:', error)
      throw new Error(error.message || 'Failed to fetch social feed')
    }
  }, [state.filters, publicKey])

  const loadPosts = useCallback(async (isRefresh: boolean = false, retryCount: number = 0) => {
    try {
      setState(prev => ({
        ...prev,
        loading: !isRefresh && prev.posts.length === 0,
        refreshing: isRefresh,
        error: null
      }))

      const offset = isRefresh ? 0 : state.posts.length
      const { posts, hasMore, total } = await fetchPosts(offset, POSTS_PER_PAGE, isRefresh)

      setState(prev => ({
        ...prev,
        posts: isRefresh ? posts : [...prev.posts, ...posts],
        hasMore,
        totalPosts: total,
        loading: false,
        refreshing: false,
        lastFetchTime: Date.now(),
        error: null
      }))

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return
      }

      console.error('Error loading posts:', error)
      
      if (retryCount < MAX_RETRIES) {
        retryTimeoutRef.current = setTimeout(() => {
          loadPosts(isRefresh, retryCount + 1)
        }, RETRY_DELAY * Math.pow(2, retryCount))
        return
      }

      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: error.message || 'Failed to load social feed'
      }))

      toast.error('Failed to load social feed')
    }
  }, [fetchPosts, state.posts.length])

  const loadMore = useCallback(async () => {
    if (state.loading || state.refreshing || !state.hasMore) return
    await loadPosts(false)
  }, [loadPosts, state.loading, state.refreshing, state.hasMore])

  const refresh = useCallback(async () => {
    if (state.loading || state.refreshing) return
    await loadPosts(true)
  }, [loadPosts, state.loading, state.refreshing])

  const updateFilters = useCallback((newFilters: Partial<SocialFeedFilters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      posts: [],
      hasMore: true,
      totalPosts: 0
    }))
  }, [])

  const interactWithPost = useCallback(async (
    postId: string,
    action: 'like' | 'unlike' | 'bookmark' | 'unbookmark' | 'share' | 'report',
    data?: any
  ) => {
    if (!publicKey || !signTransaction) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const response = await fetch('/api/social/interact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          action,
          userPubkey: publicKey.toString(),
          data
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} post`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || `Failed to ${action} post`)
      }

      // Update local state optimistically
      setState(prev => ({
        ...prev,
        posts: prev.posts.map(post => {
          if (post.id === postId) {
            switch (action) {
              case 'like':
                return { ...post, isLiked: true, likes: post.likes + 1 }
              case 'unlike':
                return { ...post, isLiked: false, likes: Math.max(0, post.likes - 1) }
              case 'bookmark':
                return { ...post, isBookmarked: true }
              case 'unbookmark':
                return { ...post, isBookmarked: false }
              case 'share':
                return { ...post, shares: post.shares + 1 }
              default:
                return post
            }
          }
          return post
        })
      }))

      if (action === 'share') {
        toast.success('Post shared successfully')
      } else if (action === 'report') {
        toast.success('Post reported successfully')
      }

    } catch (error: any) {
      console.error(`Error ${action}ing post:`, error)
      toast.error(error.message || `Failed to ${action} post`)
    }
  }, [publicKey, signTransaction])

  const likePost = useCallback(async (postId: string) => {
    await interactWithPost(postId, 'like')
  }, [interactWithPost])

  const unlikePost = useCallback(async (postId: string) => {
    await interactWithPost(postId, 'unlike')
  }, [interactWithPost])

  const bookmarkPost = useCallback(async (postId: string) => {
    await interactWithPost(postId, 'bookmark')
  }, [interactWithPost])

  const unbookmarkPost = useCallback(async (postId: string) => {
    await interactWithPost(postId, 'unbookmark')
  }, [interactWithPost])

  const sharePost = useCallback(async (postId: string) => {
    await interactWithPost(postId, 'share')
  }, [interactWithPost])

  const reportPost = useCallback(async (postId: string, reason: string) => {
    await interactWithPost(postId, 'report', { reason })
  }, [interactWithPost])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // Initial load and filter changes
  useEffect(() => {
    loadPosts(true)
  }, [state.filters])

  // Auto-refresh
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    refreshIntervalRef.current = setInterval(() => {
      if (!state.loading && !state.refreshing) {
        refresh()
      }
    }, REFRESH_INTERVAL)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [refresh, state.loading, state.refreshing])

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  return {
    posts: state.posts,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    refreshing: state.refreshing,
    filters: state.filters,
    totalPosts: state.totalPosts,
    loadMore,
    refresh,
    updateFilters,
    likePost,
    unlikePost,
    bookmarkPost,
    unbookmarkPost,
    sharePost,
    reportPost,
    clearError
  }
}
```