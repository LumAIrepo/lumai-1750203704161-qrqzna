```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { toast } from 'sonner'
import { TrendingUp, TrendingDown, Users, Lock, Unlock, ArrowUpRight, ArrowDownRight, Loader2, Wallet, RefreshCw } from 'lucide-react'

interface KeyData {
  address: string
  name: string
  username: string
  avatar: string
  price: number
  supply: number
  holders: number
  volume24h: number
  priceChange24h: number
  marketCap: number
  isOwned: boolean
  ownedAmount: number
  lastTrade: number
}

interface TradeHistory {
  id: string
  type: 'buy' | 'sell'
  amount: number
  price: number
  timestamp: number
  trader: string
  subject: string
}

const MOCK_KEYS: KeyData[] = [
  {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    name: 'Alex Chen',
    username: 'alexbuilds',
    avatar: '/api/placeholder/40/40',
    price: 0.045,
    supply: 1250,
    holders: 89,
    volume24h: 12.5,
    priceChange24h: 15.2,
    marketCap: 56.25,
    isOwned: true,
    ownedAmount: 5,
    lastTrade: Date.now() - 300000
  },
  {
    address: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi',
    name: 'Sarah Kim',
    username: 'sarahcrypto',
    avatar: '/api/placeholder/40/40',
    price: 0.032,
    supply: 890,
    holders: 67,
    volume24h: 8.9,
    priceChange24h: -5.8,
    marketCap: 28.48,
    isOwned: false,
    ownedAmount: 0,
    lastTrade: Date.now() - 600000
  }
]

const MOCK_TRADES: TradeHistory[] = [
  {
    id: '1',
    type: 'buy',
    amount: 2,
    price: 0.045,
    timestamp: Date.now() - 120000,
    trader: '7xKX...gAsU',
    subject: 'alexbuilds'
  },
  {
    id: '2',
    type: 'sell',
    amount: 1,
    price: 0.043,
    timestamp: Date.now() - 300000,
    trader: '4vJ9...bLKi',
    subject: 'sarahcrypto'
  }
]

export default function KeyTrading() {
  const { publicKey, connected, signTransaction } = useWallet()
  const [keys, setKeys] = useState<KeyData[]>(MOCK_KEYS)
  const [trades, setTrades] = useState<TradeHistory[]>(MOCK_TRADES)
  const [selectedKey, setSelectedKey] = useState<KeyData | null>(null)
  const [tradeAmount, setTradeAmount] = useState<string>('1')
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'owned' | 'trending'>('all')
  const [sortBy, setSortBy] = useState<'price' | 'volume' | 'holders' | 'change'>('volume')

  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')

  const calculateBuyPrice = useCallback((supply: number, amount: number): number => {
    const basePrice = 0.001
    const priceIncrease = 0.0001
    let totalCost = 0
    
    for (let i = 0; i < amount; i++) {
      totalCost += basePrice + (supply + i) * priceIncrease
    }
    
    return totalCost
  }, [])

  const calculateSellPrice = useCallback((supply: number, amount: number): number => {
    const basePrice = 0.001
    const priceIncrease = 0.0001
    let totalReturn = 0
    
    for (let i = 0; i < amount; i++) {
      totalReturn += basePrice + (supply - i - 1) * priceIncrease
    }
    
    return totalReturn * 0.95 // 5% fee
  }, [])

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update with slight price variations
      setKeys(prevKeys => 
        prevKeys.map(key => ({
          ...key,
          price: key.price * (0.98 + Math.random() * 0.04),
          volume24h: key.volume24h * (0.9 + Math.random() * 0.2),
          priceChange24h: (Math.random() - 0.5) * 20
        }))
      )
      
      toast.success('Data refreshed')
    } catch (error) {
      toast.error('Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const executeTrade = useCallback(async () => {
    if (!connected || !publicKey || !selectedKey) {
      toast.error('Please connect your wallet')
      return
    }

    const amount = parseInt(tradeAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (tradeType === 'sell' && amount > selectedKey.ownedAmount) {
      toast.error('Insufficient keys to sell')
      return
    }

    setIsLoading(true)

    try {
      const price = tradeType === 'buy' 
        ? calculateBuyPrice(selectedKey.supply, amount)
        : calculateSellPrice(selectedKey.supply, amount)

      if (tradeType === 'buy') {
        const balance = await connection.getBalance(publicKey)
        const requiredBalance = price * LAMPORTS_PER_SOL

        if (balance < requiredBalance) {
          toast.error('Insufficient SOL balance')
          return
        }
      }

      // Create mock transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(selectedKey.address),
          lamports: Math.floor(price * LAMPORTS_PER_SOL)
        })
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      if (signTransaction) {
        const signedTransaction = await signTransaction(transaction)
        
        // Simulate transaction confirmation
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Update local state
        setKeys(prevKeys =>
          prevKeys.map(key =>
            key.address === selectedKey.address
              ? {
                  ...key,
                  supply: tradeType === 'buy' ? key.supply + amount : key.supply - amount,
                  holders: tradeType === 'buy' ? key.holders + 1 : Math.max(1, key.holders - 1),
                  volume24h: key.volume24h + price,
                  isOwned: tradeType === 'buy' ? true : key.ownedAmount - amount > 0,
                  ownedAmount: tradeType === 'buy' ? key.ownedAmount + amount : key.ownedAmount - amount,
                  lastTrade: Date.now()
                }
              : key
          )
        )

        // Add to trade history
        const newTrade: TradeHistory = {
          id: Date.now().toString(),
          type: tradeType,
          amount,
          price,
          timestamp: Date.now(),
          trader: publicKey.toString().slice(0, 4) + '...' + publicKey.toString().slice(-4),
          subject: selectedKey.username
        }

        setTrades(prevTrades => [newTrade, ...prevTrades.slice(0, 9)])

        toast.success(`Successfully ${tradeType === 'buy' ? 'bought' : 'sold'} ${amount} key${amount > 1 ? 's' : ''}`)
        setTradeAmount('1')
      }
    } catch (error) {
      console.error('Trade error:', error)
      toast.error('Transaction failed')
    } finally {
      setIsLoading(false)
    }
  }, [connected, publicKey, selectedKey, tradeAmount, tradeType, connection, signTransaction, calculateBuyPrice, calculateSellPrice])

  const filteredKeys = keys.filter(key => {
    switch (filter) {
      case 'owned':
        return key.isOwned
      case 'trending':
        return key.priceChange24h > 0
      default:
        return true
    }
  }).sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return b.price - a.price
      case 'holders':
        return b.holders - a.holders
      case 'change':
        return b.priceChange24h - a.priceChange24h
      default:
        return b.volume24h - a.volume24h
    }
  })

  useEffect(() => {
    const interval = setInterval(refreshData, 30000)
    return () => clearInterval(interval)
  }, [refreshData])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Panel - Key List */}
          <div className="lg:w-2/3">
            <div className="bg-gray-900 rounded-xl border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Creator Keys</h2>
                    <p className="text-gray-400 mt-1">Trade keys to unlock exclusive content</p>
                  </div>
                  <button
                    onClick={refreshData}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {(['all', 'owned', 'trending'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        filter === f
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm"
                  >
                    <option value="volume">Volume</option>
                    <option value="price">Price</option>
                    <option value="holders">Holders</option>
                    <option value="change">Change</option>
                  </select>
                </div>
              </div>

              <div className="divide-y divide-gray-800">
                {filteredKeys.map(key => (
                  <div
                    key={key.address}
                    onClick={() => setSelectedKey(key)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-800 ${
                      selectedKey?.address === key.address ? 'bg-gray-800' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={key.avatar}
                            alt={key.name}
                            className="w-12 h-12 rounded-full"
                          />
                          {key.isOwned && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <Unlock className="w-2 h-2" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold">{key.name}</div>
                          <div className="text-sm text-gray-400">@{key.username}</div>
                          {key.isOwned && (
                            <div className="text-xs text-green-400">Owned: {key.ownedAmount}</div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold">{key.price.toFixed(4)} SOL</div>
                        <div className={`text-sm flex items-center gap-1 ${
                          key.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {key.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(key.priceChange24h).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between mt-3 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {key.holders} holders
                      </div>
                      <div>Vol: {key.volume24h.toFixed(2)} SOL</div>
                      <div>Supply: {key.supply}</div