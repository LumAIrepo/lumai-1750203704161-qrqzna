use anchor_lang::prelude::*;

#[error_code]
pub enum SolSocialError {
    #[msg("Insufficient funds for this operation")]
    InsufficientFunds,
    
    #[msg("Invalid bonding curve parameters")]
    InvalidBondingCurve,
    
    #[msg("Key price calculation overflow")]
    PriceCalculationOverflow,
    
    #[msg("Maximum supply exceeded")]
    MaxSupplyExceeded,
    
    #[msg("Minimum key amount not met")]
    MinimumKeyAmountNotMet,
    
    #[msg("User profile not found")]
    UserProfileNotFound,
    
    #[msg("Unauthorized access to private chat")]
    UnauthorizedChatAccess,
    
    #[msg("Insufficient key balance for chat access")]
    InsufficientKeyBalance,
    
    #[msg("Invalid chat room configuration")]
    InvalidChatRoom,
    
    #[msg("Message content exceeds maximum length")]
    MessageTooLong,
    
    #[msg("Invalid user reputation score")]
    InvalidReputationScore,
    
    #[msg("Content moderation violation")]
    ContentViolation,
    
    #[msg("Trading is currently paused")]
    TradingPaused,
    
    #[msg("Invalid slippage tolerance")]
    InvalidSlippageTolerance,
    
    #[msg("Trade deadline exceeded")]
    TradeDeadlineExceeded,
    
    #[msg("Invalid creator fee percentage")]
    InvalidCreatorFee,
    
    #[msg("Protocol fee calculation error")]
    ProtocolFeeError,
    
    #[msg("Invalid social interaction type")]
    InvalidInteractionType,
    
    #[msg("Interaction cooldown period active")]
    InteractionCooldown,
    
    #[msg("Invalid NFT metadata")]
    InvalidNFTMetadata,
    
    #[msg("NFT not owned by user")]
    NFTNotOwned,
    
    #[msg("Invalid badge configuration")]
    InvalidBadgeConfig,
    
    #[msg("Badge already claimed")]
    BadgeAlreadyClaimed,
    
    #[msg("Insufficient influence score")]
    InsufficientInfluence,
    
    #[msg("Invalid social graph connection")]
    InvalidSocialConnection,
    
    #[msg("Connection limit exceeded")]
    ConnectionLimitExceeded,
    
    #[msg("Invalid post content")]
    InvalidPostContent,
    
    #[msg("Post not found")]
    PostNotFound,
    
    #[msg("Cannot interact with own content")]
    SelfInteractionNotAllowed,
    
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    
    #[msg("Account already initialized")]
    AccountAlreadyInitialized,
    
    #[msg("Account not initialized")]
    AccountNotInitialized,
    
    #[msg("Invalid account owner")]
    InvalidAccountOwner,
    
    #[msg("Invalid program authority")]
    InvalidProgramAuthority,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    
    #[msg("Arithmetic underflow")]
    ArithmeticUnderflow,
    
    #[msg("Division by zero")]
    DivisionByZero,
    
    #[msg("Invalid percentage value")]
    InvalidPercentage,
    
    #[msg("Token mint mismatch")]
    TokenMintMismatch,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Token transfer failed")]
    TokenTransferFailed,
    
    #[msg("Invalid system program")]
    InvalidSystemProgram,
    
    #[msg("Invalid token program")]
    InvalidTokenProgram,
    
    #[msg("Invalid associated token program")]
    InvalidAssociatedTokenProgram,
    
    #[msg("Invalid rent sysvar")]
    InvalidRentSysvar,
    
    #[msg("Invalid clock sysvar")]
    InvalidClockSysvar,
    
    #[msg("Signature verification failed")]
    SignatureVerificationFailed,
    
    #[msg("Invalid instruction data")]
    InvalidInstructionData,
    
    #[msg("Instruction not allowed")]
    InstructionNotAllowed,
    
    #[msg("Feature not implemented")]
    FeatureNotImplemented,
    
    #[msg("Maintenance mode active")]
    MaintenanceMode,
    
    #[msg("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[msg("Invalid configuration")]
    InvalidConfiguration,
    
    #[msg("Configuration locked")]
    ConfigurationLocked,
    
    #[msg("Emergency pause active")]
    EmergencyPause,
    
    #[msg("Invalid upgrade authority")]
    InvalidUpgradeAuthority,
    
    #[msg("Upgrade not authorized")]
    UpgradeNotAuthorized,
    
    #[msg("Version mismatch")]
    VersionMismatch,
    
    #[msg("Deprecated feature")]
    DeprecatedFeature,
    
    #[msg("Feature disabled")]
    FeatureDisabled,
    
    #[msg("Invalid feature flag")]
    InvalidFeatureFlag,
    
    #[msg("Access denied")]
    AccessDenied,
    
    #[msg("Permission denied")]
    PermissionDenied,
    
    #[msg("Resource not available")]
    ResourceNotAvailable,
    
    #[msg("Resource locked")]
    ResourceLocked,
    
    #[msg("Resource expired")]
    ResourceExpired,
    
    #[msg("Invalid resource state")]
    InvalidResourceState,
    
    #[msg("Concurrent modification detected")]
    ConcurrentModification,
    
    #[msg("Invalid nonce")]
    InvalidNonce,
    
    #[msg("Nonce already used")]
    NonceAlreadyUsed,
    
    #[msg("Invalid signature")]
    InvalidSignature,
    
    #[msg("Signature expired")]
    SignatureExpired,
    
    #[msg("Invalid public key")]
    InvalidPublicKey,
    
    #[msg("Key derivation failed")]
    KeyDerivationFailed,
    
    #[msg("Invalid seed")]
    InvalidSeed,
    
    #[msg("Seed too long")]
    SeedTooLong,
    
    #[msg("Invalid bump seed")]
    InvalidBumpSeed,
    
    #[msg("PDA derivation failed")]
    PDADerivationFailed,
    
    #[msg("Invalid PDA")]
    InvalidPDA,
    
    #[msg("Cross program invocation failed")]
    CPIFailed,
    
    #[msg("Invalid CPI context")]
    InvalidCPIContext,
    
    #[msg("CPI not allowed")]
    CPINotAllowed,
    
    #[msg("Invalid program ID")]
    InvalidProgramId,
    
    #[msg("Program not executable")]
    ProgramNotExecutable,
    
    #[msg("Invalid account data")]
    InvalidAccountData,
    
    #[msg("Account data too small")]
    AccountDataTooSmall,
    
    #[msg("Account data too large")]
    AccountDataTooLarge,
    
    #[msg("Invalid account size")]
    InvalidAccountSize,
    
    #[msg("Account size mismatch")]
    AccountSizeMismatch,
    
    #[msg("Invalid discriminator")]
    InvalidDiscriminator,
    
    #[msg("Discriminator mismatch")]
    DiscriminatorMismatch,
    
    #[msg("Serialization failed")]
    SerializationFailed,
    
    #[msg("Deserialization failed")]
    DeserializationFailed,
    
    #[msg("Invalid data format")]
    InvalidDataFormat,
    
    #[msg("Data corruption detected")]
    DataCorruption,
    
    #[msg("Checksum mismatch")]
    ChecksumMismatch,
    
    #[msg("Invalid hash")]
    InvalidHash,
    
    #[msg("Hash collision detected")]
    HashCollision,
    
    #[msg("Encryption failed")]
    EncryptionFailed,
    
    #[msg("Decryption failed")]
    DecryptionFailed,
    
    #[msg("Invalid encryption key")]
    InvalidEncryptionKey,
    
    #[msg("Key rotation required")]
    KeyRotationRequired,
    
    #[msg("Invalid oracle data")]
    InvalidOracleData,
    
    #[msg("Oracle data stale")]
    OracleDataStale,
    
    #[msg("Oracle not available")]
    OracleNotAvailable,
    
    #[msg("Price feed error")]
    PriceFeedError,
    
    #[msg("Invalid price data")]
    InvalidPriceData,
    
    #[msg("Price deviation too high")]
    PriceDeviationTooHigh,
    
    #[msg("Liquidation threshold reached")]
    LiquidationThreshold,
    
    #[msg("Invalid liquidation")]
    InvalidLiquidation,
    
    #[msg("Liquidation not allowed")]
    LiquidationNotAllowed,
    
    #[msg("Collateral insufficient")]
    CollateralInsufficient,
    
    #[msg("Invalid collateral ratio")]
    InvalidCollateralRatio,
    
    #[msg("Margin call triggered")]
    MarginCall,
    
    #[msg("Invalid margin")]
    InvalidMargin,
    
    #[msg("Leverage too high")]
    LeverageTooHigh,
    
    #[msg("Position size too large")]
    PositionSizeTooLarge,
    
    #[msg("Invalid position")]
    InvalidPosition,
    
    #[msg("Position not found")]
    PositionNotFound,
    
    #[msg("Position already closed")]
    PositionAlreadyClosed,
    
    #[msg("Cannot close position")]
    CannotClosePosition,
    
    #[msg("Invalid order")]
    InvalidOrder,
    
    #[msg("Order not found")]
    OrderNotFound,
    
    #[msg("Order already filled")]
    OrderAlreadyFilled,
    
    #[msg("Order already cancelled")]
    OrderAlreadyCancelled,
    
    #[msg("Cannot cancel order")]
    CannotCancelOrder,
    
    #[msg("Order expired")]
    OrderExpired,
    
    #[msg("Invalid order type")]
    InvalidOrderType,
    
    #[msg("Invalid order size")]
    InvalidOrderSize,
    
    #[msg("Order size too small")]
    OrderSizeTooSmall,
    
    #[msg("Order size too large")]
    OrderSizeTooLarge,
    
    #[msg("Invalid order price")]
    InvalidOrderPrice,
    
    #[msg("Price out of range")]
    PriceOutOfRange,
    
    #[msg("Market closed")]
    MarketClosed,
    
    #[msg("Market suspended")]
    MarketSuspended,
    
    #[msg("Invalid market")]
    InvalidMarket,
    
    #[msg("Market not found")]
    MarketNotFound,
    
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    
    #[msg("Liquidity pool error")]
    LiquidityPoolError,
    
    #[msg("Invalid pool configuration")]
    InvalidPoolConfiguration,
    
    #[msg("Pool not initialized")]
    PoolNotInitialized,
    
    #[msg("Pool already initialized")]
    PoolAlreadyInitialized,
    
    #[msg("Pool paused")]
    PoolPaused,
    
    #[msg("Pool emergency stop")]
    PoolEmergencyStop,
    
    #[msg("Invalid swap")]
    InvalidSwap,
    
    #[msg("Swap failed")]
    SwapFailed,
    
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    
    #[msg("Invalid AMM calculation")]
    InvalidAMMCalculation,
    
    #[msg("AMM invariant violation")]
    AMMInvariantViolation,
    
    #[msg("Invalid fee calculation")]
    InvalidFeeCalculation,
    
    #[msg("Fee too high")]
    FeeTooHigh,
    
    #[msg("Invalid fee recipient")]
    InvalidFeeRecipient,
    
    #[msg("Fee collection failed")]
    FeeCollectionFailed,
    
    #[msg("Invalid reward calculation")]
    InvalidRewardCalculation,
    
    #[msg("Reward distribution failed")]
    RewardDistributionFailed,
    
    #[msg("Insufficient rewards")]
    InsufficientRewards,
    
    #[msg("Reward period not active")]
    RewardPeriodNotActive,
    
    #[msg("Invalid staking")]
    InvalidStaking,
    
    #[msg("Staking not allowed")]
    StakingNotAllowed,
    
    #[msg("Unstaking not allowed")]
    UnstakingNotAllowed,
    
    #[msg("Invalid staking period")]
    InvalidStakingPeriod,
    
    #[msg("Staking period not ended")]
    StakingPeriodNotEnded,
    
    #[msg("Invalid governance proposal")]
    InvalidGovernanceProposal,
    
    #[msg("Proposal not found")]
    ProposalNotFound,
    
    #[msg("Proposal already executed")]
    ProposalAlreadyExecuted,
    
    #[msg("Proposal execution failed")]
    ProposalExecutionFailed,
    
    #[msg("Invalid voting power")]
    InvalidVotingPower,
    
    #[msg("Insufficient voting power")]
    InsufficientVotingPower,
    
    #[msg("Voting period ended")]
    VotingPeriodEnded,
    
    #[msg("Already voted")]
    AlreadyVoted,
    
    #[msg("Invalid vote")]
    InvalidVote,
    
    #[msg("Quorum not reached")]
    QuorumNotReached,
    
    #[msg("Invalid multisig")]
    InvalidMultisig,
    
    #[msg("Multisig threshold not met")]
    MultisigThresholdNotMet,
    
    #[msg("Invalid multisig signer")]
    InvalidMultisigSigner,
    
    #[msg("Multisig signer already approved")]
    MultisigSignerAlreadyApproved,
    
    #[msg("Multisig transaction not found")]
    MultisigTransactionNotFound,
    
    #[msg("Multisig transaction already executed")]
    MultisigTransactionAlreadyExecuted,
    
    #[msg("Invalid timelock")]
    InvalidTimelock,
    
    #[msg("Timelock not expired")]
    TimelockNotExpired,
    
    #[msg("Timelock already executed")]
    TimelockAlreadyExecuted,
    
    #[msg("Invalid admin")]
    InvalidAdmin,
    
    #[msg("Admin privileges required")]
    AdminPrivilegesRequired,
    
    #[msg("Invalid moderator")]
    InvalidModerator,
    
    #[msg("Moderator privileges required")]
    ModeratorPrivilegesRequired,
    
    #[msg("User banned")]
    UserBanned,
    
    #[msg("User suspended")]
    UserSuspended,
    
    #[msg("Invalid user status")]
    InvalidUserStatus,
    
    #[msg("User verification required")]
    UserVerificationRequired,
    
    #[msg("Invalid verification")]
    InvalidVer