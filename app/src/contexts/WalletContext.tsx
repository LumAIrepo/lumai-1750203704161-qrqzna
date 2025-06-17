'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { WalletAdapter, WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { toast } from 'sonner'

export interface WalletContextState {
  wallet: WalletAdapter | null
  publicKey: PublicKey | null
  connected: boolean
  connecting: boolean
  disconnecting: boolean
  connection: Connection
  balance: number | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<string>
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>
  signAllTransactions: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  refreshBalance: () => Promise<void>
  isLoading: boolean
  error: string | null
}

const WalletContext = createContext<WalletContextState | undefined>(undefined)

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const {
    wallet,
    publicKey,
    connected,
    connecting,
    disconnecting,
    connect: walletConnect,
    disconnect: walletDisconnect,
    sendTransaction: walletSendTransaction,
    signTransaction: walletSignTransaction,
    signAllTransactions: walletSignAllTransactions,
    signMessage: walletSignMessage,
  } = useWallet()

  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((error: any, message: string) => {
    console.error(message, error)
    const errorMessage = error instanceof WalletError ? error.message : message
    setError(errorMessage)
    toast.error(errorMessage)
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connection) {
      setBalance(null)
      return
    }

    try {
      setIsLoading(true)
      const balance = await connection.getBalance(publicKey)
      setBalance(balance / 1e9) // Convert lamports to SOL
    } catch (error) {
      handleError(error, 'Failed to fetch wallet balance')
      setBalance(null)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, handleError])

  const connect = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)
      await walletConnect()
      toast.success('Wallet connected successfully')
    } catch (error) {
      handleError(error, 'Failed to connect wallet')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [walletConnect, handleError])

  const disconnect = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)
      await walletDisconnect()
      setBalance(null)
      toast.success('Wallet disconnected')
    } catch (error) {
      handleError(error, 'Failed to disconnect wallet')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [walletDisconnect, handleError])

  const sendTransaction = useCallback(async (transaction: Transaction | VersionedTransaction): Promise<string> => {
    if (!publicKey) {
      throw new WalletNotConnectedError()
    }

    try {
      setError(null)
      setIsLoading(true)
      const signature = await walletSendTransaction(transaction, connection)
      
      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      })

      toast.success('Transaction sent successfully')
      await refreshBalance()
      return signature
    } catch (error) {
      handleError(error, 'Failed to send transaction')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, walletSendTransaction, connection, handleError, refreshBalance])

  const signTransaction = useCallback(async <T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> => {
    if (!walletSignTransaction) {
      throw new WalletError('Wallet does not support transaction signing')
    }

    try {
      setError(null)
      return await walletSignTransaction(transaction)
    } catch (error) {
      handleError(error, 'Failed to sign transaction')
      throw error
    }
  }, [walletSignTransaction, handleError])

  const signAllTransactions = useCallback(async <T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> => {
    if (!walletSignAllTransactions) {
      throw new WalletError('Wallet does not support signing multiple transactions')
    }

    try {
      setError(null)
      return await walletSignAllTransactions(transactions)
    } catch (error) {
      handleError(error, 'Failed to sign transactions')
      throw error
    }
  }, [walletSignAllTransactions, handleError])

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!walletSignMessage) {
      throw new WalletError('Wallet does not support message signing')
    }

    try {
      setError(null)
      return await walletSignMessage(message)
    } catch (error) {
      handleError(error, 'Failed to sign message')
      throw error
    }
  }, [walletSignMessage, handleError])

  // Refresh balance when wallet connects or publicKey changes
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalance()
    }
  }, [connected, publicKey, refreshBalance])

  // Set up balance refresh interval
  useEffect(() => {
    if (!connected || !publicKey) return

    const interval = setInterval(() => {
      refreshBalance()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [connected, publicKey, refreshBalance])

  // Clear error when wallet state changes
  useEffect(() => {
    if (connected) {
      setError(null)
    }
  }, [connected])

  const contextValue: WalletContextState = {
    wallet,
    publicKey,
    connected,
    connecting,
    disconnecting,
    connection,
    balance,
    connect,
    disconnect,
    sendTransaction,
    signTransaction,
    signAllTransactions,
    signMessage,
    refreshBalance,
    isLoading: isLoading || connecting || disconnecting,
    error,
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletContextState {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return context
}

export default WalletContext