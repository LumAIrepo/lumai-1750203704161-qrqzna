```typescript
import { AnchorProvider, Program, web3, BN, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';

export interface SolSocialIDL extends Idl {
  name: 'sol_social';
  version: '0.1.0';
  instructions: Array<{
    name: string;
    accounts: Array<{
      name: string;
      isMut: boolean;
      isSigner: boolean;
    }>;
    args: Array<{
      name: string;
      type: string;
    }>;
  }>;
  accounts: Array<{
    name: string;
    type: {
      kind: 'struct';
      fields: Array<{
        name: string;
        type: string;
      }>;
    };
  }>;
  types: Array<{
    name: string;
    type: {
      kind: 'struct';
      fields: Array<{
        name: string;
        type: string;
      }>;
    };
  }>;
  errors: Array<{
    code: number;
    name: string;
    msg: string;
  }>;
}

export interface UserProfile {
  authority: PublicKey;
  username: string;
  displayName: string;
  bio: string;
  profileImageUrl: string;
  keyPrice: BN;
  keysSupply: BN;
  totalVolume: BN;
  createdAt: BN;
  isVerified: boolean;
  reputation: number;
  followersCount: number;
  followingCount: number;
  bump: number;
}

export interface UserKey {
  owner: PublicKey;
  subject: PublicKey;
  amount: BN;
  purchasePrice: BN;
  purchasedAt: BN;
  bump: number;
}

export interface SocialPost {
  authority: PublicKey;
  content: string;
  imageUrl: string;
  timestamp: BN;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  tokenWeight: BN;
  isPrivate: boolean;
  requiredKeyAmount: BN;
  bump: number;
}

export interface ChatRoom {
  creator: PublicKey;
  name: string;
  description: string;
  requiredKeyAmount: BN;
  membersCount: number;
  createdAt: BN;
  isActive: boolean;
  bump: number;
}

export interface TradeEvent {
  trader: PublicKey;
  subject: PublicKey;
  isBuy: boolean;
  keyAmount: BN;
  solAmount: BN;
  protocolFee: BN;
  subjectFee: BN;
  supply: BN;
  timestamp: BN;
}

export class SolSocialProgram {
  private program: Program<SolSocialIDL>;
  private connection: Connection;
  private provider: AnchorProvider;

  constructor(
    connection: Connection,
    wallet: WalletContextState,
    programId: PublicKey,
    idl: SolSocialIDL
  ) {
    this.connection = connection;
    this.provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed', preflightCommitment: 'confirmed' }
    );
    this.program = new Program(idl, programId, this.provider);
  }

  // PDA Derivation Functions
  async getUserProfilePDA(authority: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_profile'), authority.toBuffer()],
      this.program.programId
    );
  }

  async getUserKeyPDA(owner: PublicKey, subject: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_key'), owner.toBuffer(), subject.toBuffer()],
      this.program.programId
    );
  }

  async getSocialPostPDA(authority: PublicKey, postId: string): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('social_post'), authority.toBuffer(), Buffer.from(postId)],
      this.program.programId
    );
  }

  async getChatRoomPDA(creator: PublicKey, roomId: string): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('chat_room'), creator.toBuffer(), Buffer.from(roomId)],
      this.program.programId
    );
  }

  async getVaultPDA(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault')],
      this.program.programId
    );
  }

  // Bonding Curve Calculations
  calculatePrice(supply: number, amount: number): number {
    const sum1 = supply === 0 ? 0 : (supply - 1) * supply * (2 * (supply - 1) + 1) / 6;
    const sum2 = (supply + amount - 1) * (supply + amount) * (2 * (supply + amount - 1) + 1) / 6;
    const summation = sum2 - sum1;
    return summation * 1000 / 16000;
  }

  getBuyPrice(supply: number, amount: number): number {
    return this.calculatePrice(supply, amount);
  }

  getSellPrice(supply: number, amount: number): number {
    return this.calculatePrice(supply - amount, amount);
  }

  getBuyPriceAfterFee(supply: number, amount: number): number {
    const price = this.getBuyPrice(supply, amount);
    const protocolFee = price * 50 / 1000; // 5%
    const subjectFee = price * 50 / 1000; // 5%
    return price + protocolFee + subjectFee;
  }

  getSellPriceAfterFee(supply: number, amount: number): number {
    const price = this.getSellPrice(supply, amount);
    const protocolFee = price * 50 / 1000; // 5%
    const subjectFee = price * 50 / 1000; // 5%
    return price - protocolFee - subjectFee;
  }

  // User Profile Functions
  async createUserProfile(
    username: string,
    displayName: string,
    bio: string,
    profileImageUrl: string
  ): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const [userProfilePDA] = await this.getUserProfilePDA(this.provider.wallet.publicKey);

      const tx = await this.program.methods
        .createUserProfile(username, displayName, bio, profileImageUrl)
        .accounts({
          userProfile: userProfilePDA,
          authority: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  async updateUserProfile(
    displayName: string,
    bio: string,
    profileImageUrl: string
  ): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const [userProfilePDA] = await this.getUserProfilePDA(this.provider.wallet.publicKey);

      const tx = await this.program.methods
        .updateUserProfile(displayName, bio, profileImageUrl)
        .accounts({
          userProfile: userProfilePDA,
          authority: this.provider.wallet.publicKey,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async getUserProfile(authority: PublicKey): Promise<UserProfile | null> {
    try {
      const [userProfilePDA] = await this.getUserProfilePDA(authority);
      const profile = await this.program.account.userProfile.fetch(userProfilePDA);
      return profile as UserProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  // Key Trading Functions
  async buyKeys(subject: PublicKey, amount: number): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const [userProfilePDA] = await this.getUserProfilePDA(subject);
      const [userKeyPDA] = await this.getUserKeyPDA(this.provider.wallet.publicKey, subject);
      const [vaultPDA] = await this.getVaultPDA();

      const profile = await this.getUserProfile(subject);
      if (!profile) {
        throw new Error('Subject profile not found');
      }

      const supply = profile.keysSupply.toNumber();
      const price = this.getBuyPriceAfterFee(supply, amount);

      const tx = await this.program.methods
        .buyKeys(new BN(amount))
        .accounts({
          buyer: this.provider.wallet.publicKey,
          subject: subject,
          userProfile: userProfilePDA,
          userKey: userKeyPDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error buying keys:', error);
      throw error;
    }
  }

  async sellKeys(subject: PublicKey, amount: number): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const [userProfilePDA] = await this.getUserProfilePDA(subject);
      const [userKeyPDA] = await this.getUserKeyPDA(this.provider.wallet.publicKey, subject);
      const [vaultPDA] = await this.getVaultPDA();

      const tx = await this.program.methods
        .sellKeys(new BN(amount))
        .accounts({
          seller: this.provider.wallet.publicKey,
          subject: subject,
          userProfile: userProfilePDA,
          userKey: userKeyPDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error selling keys:', error);
      throw error;
    }
  }

  async getUserKey(owner: PublicKey, subject: PublicKey): Promise<UserKey | null> {
    try {
      const [userKeyPDA] = await this.getUserKeyPDA(owner, subject);
      const userKey = await this.program.account.userKey.fetch(userKeyPDA);
      return userKey as UserKey;
    } catch (error) {
      console.error('Error fetching user key:', error);
      return null;
    }
  }

  // Social Post Functions
  async createPost(
    content: string,
    imageUrl: string,
    isPrivate: boolean,
    requiredKeyAmount: number
  ): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const postId = Date.now().toString();
      const [socialPostPDA] = await this.getSocialPostPDA(this.provider.wallet.publicKey, postId);

      const tx = await this.program.methods
        .createPost(postId, content, imageUrl, isPrivate, new BN(requiredKeyAmount))
        .accounts({
          socialPost: socialPostPDA,
          authority: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  async likePost(postAuthority: PublicKey, postId: string): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const [socialPostPDA] = await this.getSocialPostPDA(postAuthority, postId);

      const tx = await this.program.methods
        .likePost()
        .accounts({
          socialPost: socialPostPDA,
          user: this.provider.wallet.publicKey,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  async getSocialPost(authority: PublicKey, postId: string): Promise<SocialPost | null> {
    try {
      const [socialPostPDA] = await this.getSocialPostPDA(authority, postId);
      const post = await this.program.account.socialPost.fetch(socialPostPDA);
      return post as SocialPost;
    } catch (error) {
      console.error('Error fetching social post:', error);
      return null;
    }
  }

  // Chat Room Functions
  async createChatRoom(
    roomId: string,
    name: string,
    description: string,
    requiredKeyAmount: number
  ): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const [chatRoomPDA] = await this.getChatRoomPDA(this.provider.wallet.publicKey, roomId);

      const tx = await this.program.methods
        .createChatRoom(roomId, name, description, new BN(requiredKeyAmount))
        .accounts({
          chatRoom: chatRoomPDA,
          creator: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Error creating chat room:', error);
      throw error;
    }
  }

  async joinChatRoom(creator: PublicKey, roomId: string): Promise<string> {
    try {
      if (!this.provider.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const [chatRoomPDA] = await this.getChatRoomPDA(creator, roomId);
      const [userKeyPDA] = await this.getUserKeyPDA(this.provider.wallet.publicKey, creator);

      const tx = await this.program.methods
        .joinChatRoom()
        .accounts({
          chatRoom: chatRoomPDA,
          user: this.provider.wallet.publicKey,
          userKey: userKeyPDA,
        })
        .rpc();

      return tx;