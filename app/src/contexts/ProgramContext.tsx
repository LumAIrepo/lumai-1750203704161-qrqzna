'use client'

import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, web3, BN, IdlAccounts } from '@coral-xyz/anchor'
import { toast } from 'sonner'

// Program IDL types
interface SolSocialIdl {
  version: string
  name: string
  instructions: any[]
  accounts: any[]
  types: any[]
}

// Account types
export interface UserProfile {
  authority: PublicKey
  username: string
  displayName: string
  bio: string
  profileImage: string
  keyPrice: BN
  keysOutstanding: BN
  totalVolume: BN
  reputation: number
  createdAt: BN
  isActive: boolean
}

export interface KeyHolding {
  holder: PublicKey
  subject: PublicKey
  amount: BN
  purchasePrice: BN
  timestamp: BN
}

export interface SocialPost {
  id: PublicKey
  author: PublicKey
  content: string
  timestamp: BN
  likes: BN
  shares: BN
  tokenWeight: BN
  isActive: boolean
}

export interface ChatRoom {
  id: PublicKey
  creator: PublicKey
  name: string
  description: string
  keyRequirement: BN
  members: PublicKey[]
  createdAt: BN
  isActive: boolean
}

// Context types
interface ProgramContextType {
  program: Program<SolSocialIdl> | null
  connection: Connection | null
  provider: AnchorProvider | null
  isLoading: boolean
  error: string | null
  
  // User operations
  createUserProfile: (username: string, displayName: string, bio: string, profileImage: string) => Promise<string>
  updateUserProfile: (displayName: string, bio: string, profileImage: string) => Promise<string>
  getUserProfile: (userPubkey: PublicKey) => Promise<UserProfile | null>
  
  // Key trading operations
  buyKeys: (subjectPubkey: PublicKey, amount: number) => Promise<string>
  sellKeys: (subjectPubkey: PublicKey, amount: number) => Promise<string>
  getKeyPrice: (subjectPubkey: PublicKey, amount: number, isBuy: boolean) => Promise<number>
  getUserKeyHoldings: (userPubkey: PublicKey) => Promise<KeyHolding[]>
  
  // Social operations
  createPost: (content: string) => Promise<string>
  likePost: (postId: PublicKey) => Promise<string>
  sharePost: (postId: PublicKey) => Promise<string>
  getUserPosts: (userPubkey: PublicKey) => Promise<SocialPost[]>
  getFeedPosts: (limit?: number) => Promise<SocialPost[]>
  
  // Chat operations
  createChatRoom: (name: string, description: string, keyRequirement: number) => Promise<string>
  joinChatRoom: (roomId: PublicKey) => Promise<string>
  leaveChatRoom: (roomId: PublicKey) => Promise<string>
  getUserChatRooms: (userPubkey: PublicKey) => Promise<ChatRoom[]>
  
  // Utility functions
  calculateBondingCurvePrice: (supply: number, amount: number) => number
  formatTokenAmount: (amount: BN) => string
  formatPrice: (price: number) => string
}

const ProgramContext = createContext<ProgramContextType | null>(null)

// Program ID - Replace with your actual program ID
const PROGRAM_ID = new PublicKey('SoLSociaL1111111111111111111111111111111111')

// Mock IDL for development - Replace with actual IDL
const MOCK_IDL: SolSocialIdl = {
  version: '0.1.0',
  name: 'sol_social',
  instructions: [],
  accounts: [],
  types: []
}

interface ProgramProviderProps {
  children: ReactNode
}

export function ProgramProvider({ children }: ProgramProviderProps) {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Initialize program and provider
  const { program, provider } = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !connection) {
      return { program: null, provider: null }
    }

    try {
      const provider = new AnchorProvider(
        connection,
        {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions || (async (txs) => {
            const signedTxs = []
            for (const tx of txs) {
              if (wallet.signTransaction) {
                signedTxs.push(await wallet.signTransaction(tx))
              }
            }
            return signedTxs
          })
        },
        { commitment: 'confirmed' }
      )

      const program = new Program(MOCK_IDL as any, PROGRAM_ID, provider)
      
      return { program, provider }
    } catch (err) {
      console.error('Failed to initialize program:', err)
      return { program: null, provider: null }
    }
  }, [wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions, connection])

  // Error handler
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`${operation} error:`, error)
    const message = error?.message || `Failed to ${operation.toLowerCase()}`
    setError(message)
    toast.error(message)
    throw error
  }, [])

  // User profile operations
  const createUserProfile = useCallback(async (
    username: string,
    displayName: string,
    bio: string,
    profileImage: string
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const [userProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_profile'), wallet.publicKey.toBuffer()],
        PROGRAM_ID
      )

      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: userProfilePda,
          lamports: await connection!.getMinimumBalanceForRentExemption(1000),
          space: 1000,
          programId: PROGRAM_ID
        })
      )

      const signature = await wallet.sendTransaction!(tx, connection!)
      await connection!.confirmTransaction(signature, 'confirmed')

      toast.success('Profile created successfully!')
      return signature
    } catch (error) {
      handleError(error, 'Create user profile')
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [program, wallet.publicKey, wallet.sendTransaction, connection, handleError])

  const updateUserProfile = useCallback(async (
    displayName: string,
    bio: string,
    profileImage: string
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Mock implementation - replace with actual program call
      const signature = 'mock_signature_' + Date.now()
      
      toast.success('Profile updated successfully!')
      return signature
    } catch (error) {
      handleError(error, 'Update user profile')
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [program, wallet.publicKey, handleError])

  const getUserProfile = useCallback(async (userPubkey: PublicKey): Promise<UserProfile | null> => {
    if (!program) return null

    try {
      // Mock implementation - replace with actual program call
      return {
        authority: userPubkey,
        username: 'user_' + userPubkey.toString().slice(0, 8),
        displayName: 'User',
        bio: 'Welcome to SolSocial!',
        profileImage: '',
        keyPrice: new BN(1000000),
        keysOutstanding: new BN(0),
        totalVolume: new BN(0),
        reputation: 100,
        createdAt: new BN(Date.now()),
        isActive: true
      }
    } catch (error) {
      console.error('Get user profile error:', error)
      return null
    }
  }, [program])

  // Key trading operations
  const buyKeys = useCallback(async (subjectPubkey: PublicKey, amount: number): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const price = await getKeyPrice(subjectPubkey, amount, true)
      
      // Mock implementation - replace with actual program call
      const signature = 'mock_buy_' + Date.now()
      
      toast.success(`Successfully bought ${amount} keys for ${formatPrice(price)} SOL`)
      return signature
    } catch (error) {
      handleError(error, 'Buy keys')
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [program, wallet.publicKey, handleError])

  const sellKeys = useCallback(async (subjectPubkey: PublicKey, amount: number): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const price = await getKeyPrice(subjectPubkey, amount, false)
      
      // Mock implementation - replace with actual program call
      const signature = 'mock_sell_' + Date.now()
      
      toast.success(`Successfully sold ${amount} keys for ${formatPrice(price)} SOL`)
      return signature
    } catch (error) {
      handleError(error, 'Sell keys')
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [program, wallet.publicKey, handleError])

  const getKeyPrice = useCallback(async (
    subjectPubkey: PublicKey,
    amount: number,
    isBuy: boolean
  ): Promise<number> => {
    try {
      // Mock bonding curve calculation
      const supply = Math.random() * 1000
      return calculateBondingCurvePrice(supply, amount)
    } catch (error) {
      console.error('Get key price error:', error)
      return 0
    }
  }, [])

  const getUserKeyHoldings = useCallback(async (userPubkey: PublicKey): Promise<KeyHolding[]> => {
    if (!program) return []

    try {
      // Mock implementation - replace with actual program call
      return []
    } catch (error) {
      console.error('Get user key holdings error:', error)
      return []
    }
  }, [program])

  // Social operations
  const createPost = useCallback(async (content: string): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Mock implementation - replace with actual program call
      const signature = 'mock_post_' + Date.now()
      
      toast.success('Post created successfully!')
      return signature
    } catch (error) {
      handleError(error, 'Create post')
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [program, wallet.publicKey, handleError])

  const likePost = useCallback(async (postId: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      // Mock implementation - replace with actual program call
      const signature = 'mock_like_' + Date.now()
      return signature
    } catch (error) {
      handleError(error, 'Like post')
      return ''
    }
  }, [program, wallet.publicKey, handleError])

  const sharePost = useCallback(async (postId: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      // Mock implementation - replace with actual program call
      const signature = 'mock_share_' + Date.now()
      return signature
    } catch (error) {
      handleError(error, 'Share post')
      return ''
    }
  }, [program, wallet.publicKey, handleError])

  const getUserPosts = useCallback(async (userPubkey: PublicKey): Promise<SocialPost[]> => {
    if (!program) return []

    try {
      // Mock implementation - replace with actual program call
      return []
    } catch (error) {
      console.error('Get user posts error:', error)
      return []
    }
  }, [program])

  const getFeedPosts = useCallback(async (limit: number = 20): Promise<SocialPost[]> => {
    if (!program) return []

    try {
      // Mock implementation - replace with actual program call
      return []
    } catch (error) {
      console.error('Get feed posts error:', error)
      return []
    }
  }, [program])

  // Chat operations
  const createChatRoom = useCallback(async (
    name: string,
    description: string,
    keyRequirement: number
  ): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Mock implementation - replace with actual program call
      const signature = 'mock_chat_' + Date.now()
      
      toast.success('Chat room created successfully!')
      return signature
    } catch (error) {
      handleError(error, 'Create chat room')
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [program, wallet.publicKey, handleError])

  const joinChatRoom = useCallback(async (roomId: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      // Mock implementation - replace with actual program call
      const signature = 'mock_join_' + Date.now()
      
      toast.success('Joined chat room successfully!')
      return signature
    } catch (error) {
      handleError(error, 'Join chat room')
      return ''
    }
  }, [program, wallet.publicKey, handleError])

  const leaveChatRoom = useCallback(async (roomId: PublicKey): Promise<string> => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      // Mock implementation - replace with actual program call
      const signature = 'mock_leave_' + Date.now()
      
      toast.success('Left chat room successfully!')
      return signature
    } catch (error