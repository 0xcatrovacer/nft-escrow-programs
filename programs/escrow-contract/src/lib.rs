use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod escrow_contract {
    use super::*;

    pub fn initialize(ctx: Context<InitializeEscrow>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(
        init, 
        payer = initializer,
        space = EscrowAccount::LEN
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(mut)]
    pub initializer_nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = initializer_deposit_token_account.mint == initializer_nft_mint.key()
    )]
    pub initializer_deposit_token_account: Account<'info, TokenAccount>,

    pub initializer_receive_mint: Account<'info, Mint>,

    #[account(
        constraint = initializer_receive_token_account.mint == initializer_receive_mint.key()
    )]
    pub initializer_receive_token_account: Account<'info, TokenAccount>,

    pub system_program: AccountInfo<'info>,

    pub token_program: AccountInfo<'info>,
}

#[account]
pub struct EscrowAccount {
    pub initializer_key: Pubkey,
    pub initializer_nft_mint: Pubkey,
    pub initializer_deposit_token_account: Pubkey,
    pub initializer_receive_mint: Pubkey,
    pub initializer_receive_amount: u64,
    pub initializer_receive_token_account: Pubkey,
}

impl EscrowAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 32;
}
