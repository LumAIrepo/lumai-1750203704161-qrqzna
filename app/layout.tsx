'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { WalletContextProvider } from '@/components/wallet/wallet-adapter'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <WalletContextProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            {children}
          </div>
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                border: '1px solid #374151',
              },
            }}
          />
        </WalletContextProvider>
      </body>
    </html>
  )
}