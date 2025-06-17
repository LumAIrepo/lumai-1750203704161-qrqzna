```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { toast } from 'sonner'
import { ImageIcon, VideoIcon, GifIcon, PollIcon, X, Loader2, Send, Lock, Globe, Users } from 'lucide-react'
import Image from 'next/image'

interface PostCreatorProps {
  onPostCreated?: (post: any) => void
  className?: string
}

interface MediaFile {
  file: File
  preview: string
  type: 'image' | 'video' | 'gif'
}

interface PollOption {
  id: string
  text: string
}

type PostVisibility = 'public' | 'keyholders' | 'premium'

export default function PostCreator({ onPostCreated, className = '' }: PostCreatorProps) {
  const { publicKey, signTransaction } = useWallet()
  const [content, setContent] = useState('')
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [isPosting, setIsPosting] = useState(false)
  const [showPoll, setShowPoll] = useState(false)
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: '1', text: '' },
    { id: '2', text: '' }
  ])
  const [visibility, setVisibility] = useState<PostVisibility>('public')
  const [tokenCost, setTokenCost] = useState(0)
  const [characterCount, setCharacterCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const MAX_CHARACTERS = 280
  const MAX_MEDIA_FILES = 4
  const MAX_POLL_OPTIONS = 4

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    if (text.length <= MAX_CHARACTERS) {
      setContent(text)
      setCharacterCount(text.length)
      
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    }
  }, [])

  const handleMediaUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (mediaFiles.length + files.length > MAX_MEDIA_FILES) {
      toast.error(`Maximum ${MAX_MEDIA_FILES} media files allowed`)
      return
    }

    files.forEach(file => {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error('File size must be less than 50MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const preview = e.target?.result as string
        let type: 'image' | 'video' | 'gif' = 'image'
        
        if (file.type.startsWith('video/')) type = 'video'
        else if (file.type === 'image/gif') type = 'gif'

        setMediaFiles(prev => [...prev, { file, preview, type }])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [mediaFiles.length])

  const removeMediaFile = useCallback((index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const addPollOption = useCallback(() => {
    if (pollOptions.length < MAX_POLL_OPTIONS) {
      setPollOptions(prev => [...prev, { id: Date.now().toString(), text: '' }])
    }
  }, [pollOptions.length])

  const removePollOption = useCallback((id: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter(option => option.id !== id))
    }
  }, [pollOptions.length])

  const updatePollOption = useCallback((id: string, text: string) => {
    setPollOptions(prev => prev.map(option => 
      option.id === id ? { ...option, text } : option
    ))
  }, [])

  const calculateTokenCost = useCallback(() => {
    let cost = 0.001 // Base cost in SOL
    
    if (mediaFiles.length > 0) cost += mediaFiles.length * 0.0005
    if (showPoll) cost += 0.0002
    if (visibility === 'premium') cost += 0.001
    
    setTokenCost(cost)
  }, [mediaFiles.length, showPoll, visibility])

  const validatePost = useCallback(() => {
    if (!publicKey) {
      toast.error('Please connect your wallet')
      return false
    }

    if (!content.trim() && mediaFiles.length === 0) {
      toast.error('Post cannot be empty')
      return false
    }

    if (showPoll) {
      const validOptions = pollOptions.filter(option => option.text.trim())
      if (validOptions.length < 2) {
        toast.error('Poll must have at least 2 options')
        return false
      }
    }

    return true
  }, [publicKey, content, mediaFiles.length, showPoll, pollOptions])

  const createPost = useCallback(async () => {
    if (!validatePost()) return

    setIsPosting(true)
    
    try {
      // Upload media files to IPFS/Arweave (mock implementation)
      const mediaUrls = await Promise.all(
        mediaFiles.map(async (media) => {
          // In production, upload to decentralized storage
          return {
            url: media.preview, // Mock URL
            type: media.type
          }
        })
      )

      // Create post transaction
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')
      
      const postData = {
        content: content.trim(),
        media: mediaUrls,
        poll: showPoll ? {
          options: pollOptions.filter(opt => opt.text.trim()).map(opt => opt.text.trim()),
          endTime: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        } : null,
        visibility,
        timestamp: Date.now(),
        author: publicKey.toString()
      }

      // Create transaction (mock - in production, interact with your Solana program)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey('11111111111111111111111111111112'), // Mock program ID
          lamports: Math.floor(tokenCost * LAMPORTS_PER_SOL)
        })
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      if (signTransaction) {
        const signedTransaction = await signTransaction(transaction)
        const signature = await connection.sendRawTransaction(signedTransaction.serialize())
        await connection.confirmTransaction(signature)

        // Reset form
        setContent('')
        setMediaFiles([])
        setShowPoll(false)
        setPollOptions([{ id: '1', text: '' }, { id: '2', text: '' }])
        setVisibility('public')
        setCharacterCount(0)

        toast.success('Post created successfully!')
        onPostCreated?.(postData)
      }
    } catch (error) {
      console.error('Error creating post:', error)
      toast.error('Failed to create post. Please try again.')
    } finally {
      setIsPosting(false)
    }
  }, [validatePost, mediaFiles, content, showPoll, pollOptions, visibility, tokenCost, publicKey, signTransaction, onPostCreated])

  // Calculate token cost when dependencies change
  React.useEffect(() => {
    calculateTokenCost()
  }, [calculateTokenCost])

  const getVisibilityIcon = () => {
    switch (visibility) {
      case 'public': return <Globe className="w-4 h-4" />
      case 'keyholders': return <Users className="w-4 h-4" />
      case 'premium': return <Lock className="w-4 h-4" />
    }
  }

  const getVisibilityLabel = () => {
    switch (visibility) {
      case 'public': return 'Public'
      case 'keyholders': return 'Key Holders'
      case 'premium': return 'Premium'
    }
  }

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-6 ${className}`}>
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
          {publicKey ? publicKey.toString().slice(0, 2).toUpperCase() : '?'}
        </div>
        
        <div className="flex-1 space-y-4">
          {/* Main textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="What's happening on Solana?"
            className="w-full bg-transparent text-white placeholder-gray-400 text-lg resize-none border-none outline-none min-h-[120px] max-h-[300px]"
            disabled={isPosting}
          />

          {/* Media preview */}
          {mediaFiles.length > 0 && (
            <div className={`grid gap-2 ${mediaFiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {mediaFiles.map((media, index) => (
                <div key={index} className="relative group rounded-lg overflow-hidden">
                  {media.type === 'video' ? (
                    <video
                      src={media.preview}
                      className="w-full h-48 object-cover"
                      controls
                    />
                  ) : (
                    <Image
                      src={media.preview}
                      alt="Upload preview"
                      width={300}
                      height={200}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <button
                    onClick={() => removeMediaFile(index)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Poll creator */}
          {showPoll && (
            <div className="space-y-3 p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-medium">Poll</h4>
                <button
                  onClick={() => setShowPoll(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {pollOptions.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updatePollOption(option.id, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-purple-500 outline-none"
                    maxLength={50}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => removePollOption(option.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              
              {pollOptions.length < MAX_POLL_OPTIONS && (
                <button
                  onClick={addPollOption}
                  className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                >
                  + Add option
                </button>
              )}
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <div className="flex items-center gap-4">
              {/* Media upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isPosting || mediaFiles.length >= MAX_MEDIA_FILES}
                className="text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              {/* Poll toggle */}
              <button
                onClick={() => setShowPoll(!showPoll)}
                disabled={isPosting}
                className={`transition-colors ${showPoll ? 'text-purple-400' : 'text-gray-400 hover:text-purple-400'} disabled:opacity-50`}
              >
                <PollIcon className="w-5 h-5" />
              </button>

              {/* Visibility selector */}
              <div className="relative">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as PostVisibility)}
                  disabled={isPosting}
                  className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1 text-sm appearance-none cursor-pointer hover:border-purple-500 transition-colors disabled:opacity-50"
                >
                  <option value="public">Public</option>
                  <option value="keyholders">Key Holders</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Character count */}
              <div className="flex items-center gap-2">
                <div className={`text-sm ${characterCount > MAX_CHARACTERS * 0.9 ? 'text-red-400' : 'text-gray-400'}`}>
                  {characterCount}/{MAX_CHARACTERS}
                </div>
                <div className="w-8 h-8 relative">
                  <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy