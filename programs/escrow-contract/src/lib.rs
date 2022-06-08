use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod escrow_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[account]
pub struct EscrowAccount {
    pub initializer_key: Pubkey,
    pub initializer_nft_mint: Pubkey,
    pub initializer_deposit_token_account: Pubkey,
    pub initializer_receive_amount: u64,
    pub initializer_receive_token_account: Pubkey,
}

impl EscrowAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 32;
}
