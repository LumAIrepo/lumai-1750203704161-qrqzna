```typescript
import { PublicKey } from '@solana/web3.js';

// User Types
export interface User {
  id: string;
  publicKey: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  bannerImage?: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  followerCount: number;
  followingCount: number;
  keyPrice: number;
  keySupply: number;
  totalVolume: number;
  reputationScore: number;
  influenceScore: number;
  isOnline: boolean;
  lastSeen: Date;
  socialLinks?: SocialLinks;
  badges: Badge[];
  nftProfilePicture?: NFTProfilePicture;
}

export interface SocialLinks {
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: Date;
}

export interface NFTProfilePicture {
  mintAddress: string;
  imageUrl: string;
  collectionName: string;
  verified: boolean;
}

// Key Trading Types
export interface UserKey {
  id: string;
  userId: string;
  holderPublicKey: string;
  amount: number;
  purchasePrice: number;
  currentPrice: number;
  purchasedAt: Date;
  totalReturns: number;
  user: User;
}

export interface KeyTransaction {
  id: string;
  signature: string;
  type: 'buy' | 'sell';
  userId: string;
  traderPublicKey: string;
  amount: number;
  price: number;
  totalCost: number;
  fees: number;
  timestamp: Date;
  blockHeight: number;
  user: User;
  trader: User;
}

export interface BondingCurve {
  supply: number;
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  holders: number;
}

// Social Feed Types
export interface Post {
  id: string;
  authorId: string;
  content: string;
  imageUrls?: string[];
  videoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  tokenWeight: number;
  engagementScore: number;
  author: User;
  comments: Comment[];
  mentions: User[];
  hashtags: string[];
  visibility: 'public' | 'holders_only' | 'premium';
  requiredKeyAmount?: number;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  isLiked: boolean;
  author: User;
  parentCommentId?: string;
  replies: Comment[];
}

export interface Like {
  id: string;
  userId: string;
  postId?: string;
  commentId?: string;
  createdAt: Date;
  user: User;
}

// Chat Types
export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  isPrivate: boolean;
  requiredKeyAmount: number;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  creator: User;
  members: ChatMember[];
  messages: ChatMessage[];
  imageUrl?: string;
}

export interface ChatMember {
  id: string;
  roomId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  keyAmount: number;
  user: User;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  content: string;
  messageType: 'text' | 'image' | 'gif' | 'system';
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
  isEdited: boolean;
  replyToId?: string;
  author: User;
  replyTo?: ChatMessage;
  reactions: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
  user: User;
}

// Wallet Types
export interface WalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  balance: number;
  solBalance: number;
}

export interface Transaction {
  signature: string;
  type: 'key_buy' | 'key_sell' | 'tip' | 'chat_payment' | 'nft_purchase';
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  fromAddress: string;
  toAddress: string;
  description: string;
  blockHeight?: number;
  fees: number;
}

// Revenue Types
export interface RevenueShare {
  id: string;
  userId: string;
  transactionId: string;
  amount: number;
  percentage: number;
  type: 'key_trade' | 'chat_access' | 'content_tip';
  createdAt: Date;
  paidAt?: Date;
  status: 'pending' | 'paid';
  user: User;
}

export interface CreatorEarnings {
  userId: string;
  totalEarnings: number;
  keyTradeEarnings: number;
  chatEarnings: number;
  tipEarnings: number;
  pendingEarnings: number;
  last24hEarnings: number;
  last7dEarnings: number;
  last30dEarnings: number;
  user: User;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'key_purchase' | 'key_sale' | 'new_follower' | 'post_like' | 'comment' | 'mention' | 'chat_message' | 'revenue';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  actionUrl?: string;
  relatedUserId?: string;
  relatedUser?: User;
  metadata?: Record<string, any>;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Search Types
export interface SearchResult {
  users: User[];
  posts: Post[];
  chatRooms: ChatRoom[];
  hashtags: string[];
}

export interface SearchFilters {
  type?: 'users' | 'posts' | 'rooms' | 'all';
  timeRange?: '1h' | '24h' | '7d' | '30d' | 'all';
  minKeyPrice?: number;
  maxKeyPrice?: number;
  verified?: boolean;
  hasKeys?: boolean;
}

// Analytics Types
export interface UserAnalytics {
  userId: string;
  profileViews: number;
  keyHolders: number;
  totalVolume: number;
  engagementRate: number;
  topPosts: Post[];
  revenueGrowth: number[];
  followerGrowth: number[];
  keyPriceHistory: PricePoint[];
}

export interface PricePoint {
  timestamp: Date;
  price: number;
  volume: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalVolume: number;
  totalTransactions: number;
  activeUsers24h: number;
  topTraders: User[];
  topCreators: User[];
  volumeHistory: PricePoint[];
}

// Form Types
export interface CreatePostForm {
  content: string;
  images?: File[];
  video?: File;
  visibility: 'public' | 'holders_only' | 'premium';
  requiredKeyAmount?: number;
}

export interface EditProfileForm {
  username: string;
  displayName: string;
  bio: string;
  avatar?: File;
  bannerImage?: File;
  socialLinks: SocialLinks;
}

export interface CreateChatRoomForm {
  name: string;
  description: string;
  isPrivate: boolean;
  requiredKeyAmount: number;
  image?: File;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'chat_message' | 'key_trade' | 'post_update' | 'notification' | 'user_status';
  data: any;
  timestamp: Date;
}

export interface UserStatus {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
}

// Theme Types
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
}

// Utility Types
export type SortOrder = 'asc' | 'desc';
export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';
export type UserRole = 'user' | 'creator' | 'admin' | 'moderator';
export type ContentVisibility = 'public' | 'holders_only' | 'premium';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';
export type NotificationType = 'key_purchase' | 'key_sale' | 'new_follower' | 'post_like' | 'comment' | 'mention' | 'chat_message' | 'revenue';

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

export interface InfiniteScrollState<T> {
  data: T[];
  hasMore: boolean;
  isLoading: boolean;
  error?: string | null;
  page: number;
}
```