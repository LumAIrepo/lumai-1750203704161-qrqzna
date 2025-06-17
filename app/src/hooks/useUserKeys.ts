```typescript
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Program, AnchorProvider, web3, BN, IdlAccounts } from '@coral-xyz/anchor'
import { toast } from 'sonner'

export interface UserKey {
  id: string
  owner: PublicKey
  subject: PublicKey
  supply: number
  price: number
  holders: number
  volume24h: number
  marketCap: number
  createdAt: Date
  lastTradeAt: Date
  isActive: boolean
}

export interface KeyTrade {
  id: string
  keyId: string
  trader: PublicKey
  isBuy: boolean
  amount: number
  price: number
  timestamp: Date
  txSignature: string
}

export interface KeyHolding {
  keyId: string
  amount: number
  averagePrice: number
  totalValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

interface UseUserKeysReturn {
  userKeys: UserKey[]
  keyHoldings: KeyHolding[]
  recentTrades: KeyTrade[]
  isLoading: boolean
  error: string | null
  buyKey: (keyId: string, amount: number) => Promise<boolean>
  sellKey: (keyId: string, amount: number) => Promise<boolean>
  createKey: (subject: PublicKey) => Promise<string | null>
  getKeyPrice: (keyId: string, amount: number, isBuy: boolean) => Promise<number>
  refreshData: () => Promise<void>
  getKeyById: (keyId: string) => UserKey | null
  getUserHoldings: (userPubkey: PublicKey) => KeyHolding[]
  calculateBondingCurvePrice: (supply: number, amount: number) => number
}

const PROGRAM_ID = new PublicKey('SoLSociaL1111111111111111111111111111111111')
const BASE_PRICE = 0.001 // SOL
const PRICE_INCREMENT = 0.0001 // SOL per key

export function useUserKeys(): UseUserKeysReturn {
  const { connection } = useConnection()
  const { publicKey, signTransaction } = useWallet()
  
  const [userKeys, setUserKeys] = useState<UserKey[]>([])
  const [keyHoldings, setKeyHoldings] = useState<KeyHolding[]>([])
  const [recentTrades, setRecentTrades] = useState<KeyTrade[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateBondingCurvePrice = useCallback((supply: number, amount: number): number => {
    if (amount <= 0) return 0
    
    let totalPrice = 0
    for (let i = 0; i < amount; i++) {
      const currentSupply = supply + i
      const price = BASE_PRICE + (currentSupply * PRICE_INCREMENT)
      totalPrice += price
    }
    
    return totalPrice
  }, [])

  const getKeyPrice = useCallback(async (keyId: string, amount: number, isBuy: boolean): Promise<number> => {
    try {
      const key = userKeys.find(k => k.id === keyId)
      if (!key) throw new Error('Key not found')

      if (isBuy) {
        return calculateBondingCurvePrice(key.supply, amount)
      } else {
        // For selling, calculate price from current supply going down
        let totalPrice = 0
        for (let i = 0; i < amount; i++) {
          const currentSupply = key.supply - i - 1
          if (currentSupply < 0) break
          const price = BASE_PRICE + (currentSupply * PRICE_INCREMENT)
          totalPrice += price
        }
        return totalPrice * 0.95 // 5% selling fee
      }
    } catch (err) {
      console.error('Error calculating key price:', err)
      return 0
    }
  }, [userKeys, calculateBondingCurvePrice])

  const fetchUserKeys = useCallback(async () => {
    try {
      setError(null)
      
      // Simulate fetching from Solana program
      const mockKeys: UserKey[] = [
        {
          id: '1',
          owner: new PublicKey('11111111111111111111111111111112'),
          subject: new PublicKey('11111111111111111111111111111113'),
          supply: 100,
          price: 0.05,
          holders: 25,
          volume24h: 2.5,
          marketCap: 5.0,
          createdAt: new Date(Date.now() - 86400000),
          lastTradeAt: new Date(Date.now() - 3600000),
          isActive: true
        },
        {
          id: '2',
          owner: new PublicKey('11111111111111111111111111111114'),
          subject: new PublicKey('11111111111111111111111111111115'),
          supply: 250,
          price: 0.125,
          holders: 45,
          volume24h: 8.2,
          marketCap: 31.25,
          createdAt: new Date(Date.now() - 172800000),
          lastTradeAt: new Date(Date.now() - 1800000),
          isActive: true
        }
      ]
      
      setUserKeys(mockKeys)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user keys'
      setError(errorMessage)
      console.error('Error fetching user keys:', err)
    }
  }, [])

  const fetchKeyHoldings = useCallback(async () => {
    if (!publicKey) return

    try {
      // Simulate fetching user holdings
      const mockHoldings: KeyHolding[] = [
        {
          keyId: '1',
          amount: 10,
          averagePrice: 0.03,
          totalValue: 0.5,
          unrealizedPnl: 0.2,
          unrealizedPnlPercent: 66.67
        },
        {
          keyId: '2',
          amount: 5,
          averagePrice: 0.1,
          totalValue: 0.625,
          unrealizedPnl: 0.125,
          unrealizedPnlPercent: 25.0
        }
      ]
      
      setKeyHoldings(mockHoldings)
    } catch (err) {
      console.error('Error fetching key holdings:', err)
    }
  }, [publicKey])

  const fetchRecentTrades = useCallback(async () => {
    try {
      // Simulate fetching recent trades
      const mockTrades: KeyTrade[] = [
        {
          id: '1',
          keyId: '1',
          trader: new PublicKey('11111111111111111111111111111116'),
          isBuy: true,
          amount: 5,
          price: 0.25,
          timestamp: new Date(Date.now() - 1800000),
          txSignature: 'mock_signature_1'
        },
        {
          id: '2',
          keyId: '2',
          trader: new PublicKey('11111111111111111111111111111117'),
          isBuy: false,
          amount: 3,
          price: 0.36,
          timestamp: new Date(Date.now() - 3600000),
          txSignature: 'mock_signature_2'
        }
      ]
      
      setRecentTrades(mockTrades)
    } catch (err) {
      console.error('Error fetching recent trades:', err)
    }
  }, [])

  const buyKey = useCallback(async (keyId: string, amount: number): Promise<boolean> => {
    if (!publicKey || !signTransaction) {
      toast.error('Wallet not connected')
      return false
    }

    if (amount <= 0) {
      toast.error('Invalid amount')
      return false
    }

    try {
      setIsLoading(true)
      setError(null)

      const key = userKeys.find(k => k.id === keyId)
      if (!key) {
        toast.error('Key not found')
        return false
      }

      const totalPrice = await getKeyPrice(keyId, amount, true)
      const priceInLamports = Math.floor(totalPrice * LAMPORTS_PER_SOL)

      // Check balance
      const balance = await connection.getBalance(publicKey)
      if (balance < priceInLamports) {
        toast.error('Insufficient balance')
        return false
      }

      // Create transaction
      const transaction = new Transaction()
      
      // Add transfer instruction (simplified)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: key.owner,
          lamports: priceInLamports,
        })
      )

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize())
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed')

      // Update local state
      setUserKeys(prev => prev.map(k => 
        k.id === keyId 
          ? { ...k, supply: k.supply + amount, holders: k.holders + 1 }
          : k
      ))

      // Update holdings
      setKeyHoldings(prev => {
        const existing = prev.find(h => h.keyId === keyId)
        if (existing) {
          const newAmount = existing.amount + amount
          const newAveragePrice = (existing.averagePrice * existing.amount + totalPrice) / newAmount
          return prev.map(h => 
            h.keyId === keyId 
              ? { 
                  ...h, 
                  amount: newAmount,
                  averagePrice: newAveragePrice,
                  totalValue: newAmount * key.price
                }
              : h
          )
        } else {
          return [...prev, {
            keyId,
            amount,
            averagePrice: totalPrice / amount,
            totalValue: amount * key.price,
            unrealizedPnl: 0,
            unrealizedPnlPercent: 0
          }]
        }
      })

      toast.success(`Successfully bought ${amount} keys for ${totalPrice.toFixed(4)} SOL`)
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to buy key'
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Error buying key:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, signTransaction, connection, userKeys, getKeyPrice])

  const sellKey = useCallback(async (keyId: string, amount: number): Promise<boolean> => {
    if (!publicKey || !signTransaction) {
      toast.error('Wallet not connected')
      return false
    }

    if (amount <= 0) {
      toast.error('Invalid amount')
      return false
    }

    try {
      setIsLoading(true)
      setError(null)

      const holding = keyHoldings.find(h => h.keyId === keyId)
      if (!holding || holding.amount < amount) {
        toast.error('Insufficient key balance')
        return false
      }

      const key = userKeys.find(k => k.id === keyId)
      if (!key) {
        toast.error('Key not found')
        return false
      }

      const totalPrice = await getKeyPrice(keyId, amount, false)
      const priceInLamports = Math.floor(totalPrice * LAMPORTS_PER_SOL)

      // Create transaction
      const transaction = new Transaction()
      
      // Add transfer instruction (simplified - in reality would interact with program)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: key.owner,
          toPubkey: publicKey,
          lamports: priceInLamports,
        })
      )

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize())
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed')

      // Update local state
      setUserKeys(prev => prev.map(k => 
        k.id === keyId 
          ? { ...k, supply: Math.max(0, k.supply - amount) }
          : k
      ))

      // Update holdings
      setKeyHoldings(prev => prev.map(h => 
        h.keyId === keyId 
          ? { 
              ...h, 
              amount: h.amount - amount,
              totalValue: (h.amount - amount) * key.price
            }
          : h
      ).filter(h => h.amount > 0))

      toast.success(`Successfully sold ${amount} keys for ${totalPrice.toFixed(4)} SOL`)
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sell key'
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('Error selling key:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, signTransaction, connection, userKeys, keyHoldings, getKeyPrice])

  const createKey = useCallback(async (subject: PublicKey): Promise<string | null> => {
    if (!publicKey || !signTransaction) {
      toast.error('Wallet not connected')
      return null
    }

    try {
      setIsLoading(true)
      setError(null)

      // Check if key already exists for subject
      const existingKey = userKeys.find(k => k.subject.equals(subject))
      if (existingKey) {
        toast.error('Key already exists for this user')
        return null
      }

      // Create transaction (simplified)
      const transaction = new Transaction()
      
      // In reality, this would call the program to create a new key
      const creationFee = 0.01 * LAMPORTS_PER_SOL
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey('11111111111111111111111111111111'), // Protocol fee account
          lamports: creationFee,
        })
      )

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize())
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed')

      // Create new key