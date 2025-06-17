import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolSocial } from "../target/types/sol_social";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { expect } from "chai";

describe("SolSocial", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolSocial as Program<SolSocial>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  let globalState: PublicKey;
  let userProfile: PublicKey;
  let userKeys: PublicKey;
  let bondingCurve: PublicKey;
  let socialPost: PublicKey;
  let chatRoom: PublicKey;
  let userReputation: PublicKey;

  const user = Keypair.generate();
  const creator = Keypair.generate();
  const trader = Keypair.generate();

  before(async () => {
    // Airdrop SOL to test accounts
    await connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(trader.publicKey, 10 * LAMPORTS_PER_SOL);
    
    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Derive PDAs
    [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    [userProfile] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), user.publicKey.toBuffer()],
      program.programId
    );

    [userKeys] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_keys"), creator.publicKey.toBuffer()],
      program.programId
    );

    [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), creator.publicKey.toBuffer()],
      program.programId
    );

    [socialPost] = PublicKey.findProgramAddressSync(
      [Buffer.from("social_post"), user.publicKey.toBuffer(), Buffer.from("1")],
      program.programId
    );

    [chatRoom] = PublicKey.findProgramAddressSync(
      [Buffer.from("chat_room"), creator.publicKey.toBuffer()],
      program.programId
    );

    [userReputation] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_reputation"), user.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("Initialization", () => {
    it("Initializes global state", async () => {
      try {
        await program.methods
          .initializeGlobalState(
            new anchor.BN(1000000), // platform_fee_bps
            new anchor.BN(500000),  // creator_fee_bps
            new anchor.BN(100),     // base_price
            new anchor.BN(1000)     // price_increment
          )
          .accounts({
            globalState,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const globalStateAccount = await program.account.globalState.fetch(globalState);
        expect(globalStateAccount.authority.toString()).to.equal(wallet.publicKey.toString());
        expect(globalStateAccount.platformFeeBps.toNumber()).to.equal(1000000);
        expect(globalStateAccount.creatorFeeBps.toNumber()).to.equal(500000);
      } catch (error) {
        console.error("Initialize global state error:", error);
        throw error;
      }
    });
  });

  describe("User Management", () => {
    it("Creates user profile", async () => {
      try {
        await program.methods
          .createUserProfile("testuser", "Test User Bio", "https://example.com/avatar.jpg")
          .accounts({
            userProfile,
            user: user.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        const userProfileAccount = await program.account.userProfile.fetch(userProfile);
        expect(userProfileAccount.user.toString()).to.equal(user.publicKey.toString());
        expect(userProfileAccount.username).to.equal("testuser");
        expect(userProfileAccount.bio).to.equal("Test User Bio");
        expect(userProfileAccount.avatarUrl).to.equal("https://example.com/avatar.jpg");
      } catch (error) {
        console.error("Create user profile error:", error);
        throw error;
      }
    });

    it("Updates user profile", async () => {
      try {
        await program.methods
          .updateUserProfile("updateduser", "Updated Bio", "https://example.com/new-avatar.jpg")
          .accounts({
            userProfile,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();

        const userProfileAccount = await program.account.userProfile.fetch(userProfile);
        expect(userProfileAccount.username).to.equal("updateduser");
        expect(userProfileAccount.bio).to.equal("Updated Bio");
        expect(userProfileAccount.avatarUrl).to.equal("https://example.com/new-avatar.jpg");
      } catch (error) {
        console.error("Update user profile error:", error);
        throw error;
      }
    });
  });

  describe("Key Trading System", () => {
    it("Initializes user keys", async () => {
      try {
        await program.methods
          .initializeUserKeys()
          .accounts({
            userKeys,
            bondingCurve,
            creator: creator.publicKey,
            globalState,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        const userKeysAccount = await program.account.userKeys.fetch(userKeys);
        const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurve);
        
        expect(userKeysAccount.creator.toString()).to.equal(creator.publicKey.toString());
        expect(userKeysAccount.totalSupply.toNumber()).to.equal(0);
        expect(bondingCurveAccount.creator.toString()).to.equal(creator.publicKey.toString());
      } catch (error) {
        console.error("Initialize user keys error:", error);
        throw error;
      }
    });

    it("Buys user keys", async () => {
      try {
        const amount = new anchor.BN(5);
        const maxPrice = new anchor.BN(1000000);

        await program.methods
          .buyKeys(amount, maxPrice)
          .accounts({
            userKeys,
            bondingCurve,
            buyer: trader.publicKey,
            creator: creator.publicKey,
            globalState,
            systemProgram: SystemProgram.programId,
          })
          .signers([trader])
          .rpc();

        const userKeysAccount = await program.account.userKeys.fetch(userKeys);
        expect(userKeysAccount.totalSupply.toNumber()).to.equal(5);
        
        const holderBalance = userKeysAccount.holders.find(
          h => h.holder.toString() === trader.publicKey.toString()
        );
        expect(holderBalance?.balance.toNumber()).to.equal(5);
      } catch (error) {
        console.error("Buy keys error:", error);
        throw error;
      }
    });

    it("Sells user keys", async () => {
      try {
        const amount = new anchor.BN(2);
        const minPrice = new anchor.BN(1);

        await program.methods
          .sellKeys(amount, minPrice)
          .accounts({
            userKeys,
            bondingCurve,
            seller: trader.publicKey,
            creator: creator.publicKey,
            globalState,
            systemProgram: SystemProgram.programId,
          })
          .signers([trader])
          .rpc();

        const userKeysAccount = await program.account.userKeys.fetch(userKeys);
        expect(userKeysAccount.totalSupply.toNumber()).to.equal(3);
        
        const holderBalance = userKeysAccount.holders.find(
          h => h.holder.toString() === trader.publicKey.toString()
        );
        expect(holderBalance?.balance.toNumber()).to.equal(3);
      } catch (error) {
        console.error("Sell keys error:", error);
        throw error;
      }
    });

    it("Gets key price", async () => {
      try {
        const amount = new anchor.BN(1);
        const isBuy = true;

        const price = await program.methods
          .getKeyPrice(amount, isBuy)
          .accounts({
            bondingCurve,
          })
          .view();

        expect(price.toNumber()).to.be.greaterThan(0);
      } catch (error) {
        console.error("Get key price error:", error);
        throw error;
      }
    });
  });

  describe("Social Features", () => {
    it("Creates social post", async () => {
      try {
        await program.methods
          .createSocialPost("Hello SolSocial!", "general", [])
          .accounts({
            socialPost,
            author: user.publicKey,
            userReputation,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        const socialPostAccount = await program.account.socialPost.fetch(socialPost);
        expect(socialPostAccount.author.toString()).to.equal(user.publicKey.toString());
        expect(socialPostAccount.content).to.equal("Hello SolSocial!");
        expect(socialPostAccount.category).to.equal("general");
        expect(socialPostAccount.likes.toNumber()).to.equal(0);
        expect(socialPostAccount.shares.toNumber()).to.equal(0);
      } catch (error) {
        console.error("Create social post error:", error);
        throw error;
      }
    });

    it("Likes social post", async () => {
      try {
        await program.methods
          .likeSocialPost()
          .accounts({
            socialPost,
            user: trader.publicKey,
            userReputation,
          })
          .signers([trader])
          .rpc();

        const socialPostAccount = await program.account.socialPost.fetch(socialPost);
        expect(socialPostAccount.likes.toNumber()).to.equal(1);
      } catch (error) {
        console.error("Like social post error:", error);
        throw error;
      }
    });

    it("Shares social post", async () => {
      try {
        await program.methods
          .shareSocialPost()
          .accounts({
            socialPost,
            user: trader.publicKey,
            userReputation,
          })
          .signers([trader])
          .rpc();

        const socialPostAccount = await program.account.socialPost.fetch(socialPost);
        expect(socialPostAccount.shares.toNumber()).to.equal(1);
      } catch (error) {
        console.error("Share social post error:", error);
        throw error;
      }
    });
  });

  describe("Chat Rooms", () => {
    it("Creates chat room", async () => {
      try {
        await program.methods
          .createChatRoom("VIP Chat", new anchor.BN(1))
          .accounts({
            chatRoom,
            creator: creator.publicKey,
            userKeys,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();

        const chatRoomAccount = await program.account.chatRoom.fetch(chatRoom);
        expect(chatRoomAccount.creator.toString()).to.equal(creator.publicKey.toString());
        expect(chatRoomAccount.name).to.equal("VIP Chat");
        expect(chatRoomAccount.requiredKeys.toNumber()).to.equal(1);
        expect(chatRoomAccount.isActive).to.be.true;
      } catch (error) {
        console.error("Create chat room error:", error);
        throw error;
      }
    });

    it("Joins chat room", async () => {
      try {
        await program.methods
          .joinChatRoom()
          .accounts({
            chatRoom,
            user: trader.publicKey,
            userKeys,
          })
          .signers([trader])
          .rpc();

        const chatRoomAccount = await program.account.chatRoom.fetch(chatRoom);
        const isMember = chatRoomAccount.members.some(
          member => member.toString() === trader.publicKey.toString()
        );
        expect(isMember).to.be.true;
      } catch (error) {
        console.error("Join chat room error:", error);
        throw error;
      }
    });
  });

  describe("Reputation System", () => {
    it("Initializes user reputation", async () => {
      try {
        await program.methods
          .initializeUserReputation()
          .accounts({
            userReputation,
            user: user.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        const userReputationAccount = await program.account.userReputation.fetch(userReputation);
        expect(userReputationAccount.user.toString()).to.equal(user.publicKey.toString());
        expect(userReputationAccount.score.toNumber()).to.equal(0);
        expect(userReputationAccount.level.toNumber()).to.equal(1);
      } catch (error) {
        console.error("Initialize user reputation error:", error);
        throw error;
      }
    });

    it("Updates reputation score", async () => {
      try {
        await program.methods
          .updateReputationScore(new anchor.BN(100))
          .accounts({
            userReputation,
            authority: wallet.publicKey,
          })
          .rpc();

        const userReputationAccount = await program.account.userReputation.fetch(userReputation);
        expect(userReputationAccount.score.toNumber()).to.equal(100);
      } catch (error) {
        console.error("Update reputation score error:", error);
        throw error;
      }
    });
  });

  describe("Revenue Distribution", () => {
    it("Distributes trading fees", async () => {
      try {
        const totalFees = new anchor.BN(1000000);

        await program.methods
          .distributeTradingFees(totalFees)
          .accounts({
            userKeys,
            creator: creator.publicKey,
            globalState,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const userKeysAccount = await program.account.userKeys.fetch(userKeys);
        expect(userKeysAccount.totalRevenue.toNumber()).to.be.greaterThan(0);
      } catch (error) {
        console.error("Distribute trading fees error:", error);
        throw error;
      }
    });
  });

  describe("Error Handling", () => {
    it("