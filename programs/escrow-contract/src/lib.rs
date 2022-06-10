use anchor_lang::prelude::*;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, CloseAccount, Mint, SetAuthority, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod escrow_contract {

    use super::*;

    const ESCROW_PDA_SEEDS: &[u8] = b"escrow";

    pub fn initialize_escrow(ctx: Context<InitializeEscrow>, receive_amount: u64) -> Result<()> {
        let escrow_account = &mut ctx.accounts.escrow_account;
        let initializer = &mut ctx.accounts.initializer;
        let initializer_deposit = &mut ctx.accounts.initializer_deposit_token_account;
        let initializer_receive = &mut ctx.accounts.initializer_receive_token_account;

        escrow_account.initializer_key = *initializer.key;
        escrow_account.initializer_nft_mint =
            *ctx.accounts.initializer_nft_mint.to_account_info().key;
        escrow_account.initializer_deposit_token_account =
            *initializer_deposit.to_account_info().key;
        escrow_account.initializer_receive_mint =
            *ctx.accounts.initializer_receive_mint.to_account_info().key;
        escrow_account.initializer_receive_amount = receive_amount;
        escrow_account.initializer_receive_token_account =
            *initializer_receive.to_account_info().key;

        let (vault_authority, _vault_account_bump) =
            Pubkey::find_program_address(&[ESCROW_PDA_SEEDS], ctx.program_id);

        token::set_authority(
            ctx.accounts.set_authority_context(),
            AuthorityType::AccountOwner,
            Some(vault_authority),
        )?;

        token::transfer(ctx.accounts.transfer_nft_context(), 1)?;

        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let (_vault_authority, _vault_authority_bump) =
            Pubkey::find_program_address(&[ESCROW_PDA_SEEDS], ctx.program_id);

        let authority_seeds = &[&ESCROW_PDA_SEEDS[..], &[_vault_authority_bump]];

        token::transfer(
            ctx.accounts
                .transfer_nft_back_context()
                .with_signer(&[&authority_seeds[..]]),
            1,
        )?;

        token::close_account(
            ctx.accounts
                .close_account_context()
                .with_signer(&[&authority_seeds[..]]),
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(
        init,
        seeds = [
            initializer.to_account_info().key.as_ref(),
            initializer_nft_mint.to_account_info().key.as_ref(),
            ],
        bump,
        payer = initializer,
        token::mint = initializer_nft_mint,
        token::authority = initializer,
    )]
    pub vault_account: Box<Account<'info, TokenAccount>>,

    #[account(zero)]
    pub escrow_account: Account<'info, EscrowAccount>,

    /// CHECK: This is not dangerous
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,

    #[account(mut)]
    pub initializer_nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = initializer_deposit_token_account.mint == initializer_nft_mint.key(),
        constraint = initializer_deposit_token_account.owner == *initializer.key,
    )]
    pub initializer_deposit_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub initializer_receive_mint: Account<'info, Mint>,

    #[account(
        constraint = initializer_receive_token_account.mint == initializer_receive_mint.key(),
        constraint = initializer_receive_token_account.owner == *initializer.key,
    )]
    pub initializer_receive_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous
    pub token_program: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeEscrow<'info> {
    fn transfer_nft_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .initializer_deposit_token_account
                .to_account_info()
                .clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.initializer.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.vault_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        constraint = vault_account.owner == *vault_authority.key,
    )]
    pub vault_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = escrow_account.initializer_key == *initializer.key,
        constraint = escrow_account.initializer_deposit_token_account == *initializer_deposit_token_account.to_account_info().key,
        close = initializer
    )]
    pub escrow_account: Box<Account<'info, EscrowAccount>>,

    #[account(
        mut,
        constraint = initializer_deposit_token_account.owner == *initializer.key,
    )]
    pub initializer_deposit_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is not dangerous
    pub vault_authority: AccountInfo<'info>,

    /// CHECK: This is not dangerous
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,

    /// CHECK: This is not dangerous
    pub token_program: AccountInfo<'info>,
}

impl<'info> Cancel<'info> {
    fn transfer_nft_back_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.vault_account.to_account_info().clone(),
            to: self
                .initializer_deposit_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn close_account_context(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.vault_account.to_account_info().clone(),
            destination: self.initializer.clone(),
            authority: self.vault_authority.clone(),
        };

        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Exchange<'info> {
    #[account(
        mut,
        constraint = escrow_account.initializer_receive_amount <= taker_deposit_token_account.amount,
        constraint = escrow_account.initializer_deposit_token_account == *initializer_deposit_token_account.to_account_info().key,
        constraint = escrow_account.initializer_receive_token_account == *initializer_receive_token_account.to_account_info().key,
        constraint = escrow_account.initializer_key == *initializer.key,
    )]
    pub escrow_account: Box<Account<'info, EscrowAccount>>,

    #[account(mut)]
    pub vault_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous
    pub vault_authority: AccountInfo<'info>,

    /// CHECK: This is not dangerous
    #[account(mut)]
    pub initializer: AccountInfo<'info>,

    /// CHECK: This is not dangerous
    #[account(mut, signer)]
    pub taker: AccountInfo<'info>,

    #[account(
        mut,
        constraint = initializer_deposit_token_account.owner == *initializer.key,
    )]
    pub initializer_deposit_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = initializer_receive_token_account.owner == *initializer.key,
    )]
    pub initializer_receive_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = taker_deposit_token_account.owner == *taker.key
    )]
    pub taker_deposit_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = taker_receive_token_account.owner == *taker.key
    )]
    pub taker_receive_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous
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
