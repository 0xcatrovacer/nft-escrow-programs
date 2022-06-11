import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
    createMint,
    createAccount,
    mintTo,
    getAccount,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { EscrowContract } from "../target/types/escrow_contract";
import { assert } from "chai";

describe("escrow-contract", () => {
    const provider = anchor.AnchorProvider.env();

    anchor.setProvider(provider);

    const program = anchor.workspace.EscrowContract as Program<EscrowContract>;

    let nftMint = null;
    let tokenMint = null;
    let initializerNftAccount = null;
    let initializerTokenAccount = null;
    let takerNftAccount = null;
    let takerTokenAccount = null;
    let vault_account_pda = null;
    let vault_account_bump = null;
    let vault_authority_pda = null;
    let feeTokenAccount = null;

    const escrowAccount = anchor.web3.Keypair.generate();
    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();
    const initializerMainAccount = anchor.web3.Keypair.generate();
    const takerMainAccount = anchor.web3.Keypair.generate();
    const feeMainAccount = provider.wallet;

    const usdcDecimals = 1000000;

    const receiveAmount = new anchor.BN(100 * usdcDecimals);
    const feePercentage = 3;
    const feeAmount = new anchor.BN(
        (receiveAmount.toNumber() * feePercentage) / 100
    );

    it("Initializes program state", async () => {
        const transferTx = await provider.connection.requestAirdrop(
            payer.publicKey,
            500000000
        );

        await provider.connection.confirmTransaction(transferTx);

        const tx = new Transaction();
        tx.add(
            SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: initializerMainAccount.publicKey,
                lamports: 100000000,
            }),
            SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: takerMainAccount.publicKey,
                lamports: 100000000,
            })
        );

        await provider.sendAndConfirm(tx, [payer]);

        nftMint = await createMint(
            provider.connection,
            payer,
            mintAuthority.publicKey,
            undefined,
            0,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );

        tokenMint = await createMint(
            provider.connection,
            payer,
            mintAuthority.publicKey,
            undefined,
            6,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );

        initializerNftAccount = await createAccount(
            provider.connection,
            payer,
            nftMint,
            initializerMainAccount.publicKey,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );
        takerNftAccount = await createAccount(
            provider.connection,
            payer,
            nftMint,
            takerMainAccount.publicKey,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );

        initializerTokenAccount = await createAccount(
            provider.connection,
            payer,
            tokenMint,
            initializerMainAccount.publicKey,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );
        takerTokenAccount = await createAccount(
            provider.connection,
            payer,
            tokenMint,
            takerMainAccount.publicKey,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );
        feeTokenAccount = await createAccount(
            provider.connection,
            payer,
            tokenMint,
            feeMainAccount.publicKey,
            undefined,
            undefined,
            TOKEN_PROGRAM_ID
        );

        await mintTo(
            provider.connection,
            payer,
            nftMint,
            initializerNftAccount,
            mintAuthority,
            1
        );

        await mintTo(
            provider.connection,
            payer,
            tokenMint,
            takerTokenAccount,
            mintAuthority,
            receiveAmount.toNumber()
        );

        let _initializerNftAccount = await getAccount(
            provider.connection,
            initializerNftAccount
        );
        let _takerNftAccount = await getAccount(
            provider.connection,
            takerTokenAccount
        );

        assert.ok(_initializerNftAccount.amount.toString() == "1");
        assert.ok(
            _takerNftAccount.amount.toString() == receiveAmount.toString()
        );
    });

    it("Can initialize escrow", async () => {
        const [_vault_account_pda, _vault_account_bump] =
            await PublicKey.findProgramAddress(
                [
                    initializerMainAccount.publicKey.toBuffer(),
                    nftMint.toBuffer(),
                ],
                program.programId
            );

        vault_account_pda = _vault_account_pda;
        vault_account_bump = _vault_account_bump;

        const [_vault_authority_pda, _vault_authority_bump] =
            await PublicKey.findProgramAddress(
                [Buffer.from(anchor.utils.bytes.utf8.encode("escrow"))],
                program.programId
            );

        vault_authority_pda = _vault_authority_pda;

        await program.methods
            .initializeEscrow(receiveAmount)
            .accounts({
                vaultAccount: vault_account_pda,
                escrowAccount: escrowAccount.publicKey,
                initializer: initializerMainAccount.publicKey,
                initializerNftMint: nftMint,
                initializerDepositTokenAccount: initializerNftAccount,
                initializerReceiveMint: tokenMint,
                initializerReceiveTokenAccount: initializerTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .preInstructions([
                await program.account.escrowAccount.createInstruction(
                    escrowAccount
                ),
            ])
            .signers([escrowAccount, initializerMainAccount])
            .rpc();

        let _escrowAccount = await program.account.escrowAccount.fetch(
            escrowAccount.publicKey
        );

        assert.ok(
            _escrowAccount.initializerKey.equals(
                initializerMainAccount.publicKey
            )
        );
        assert.ok(
            _escrowAccount.initializerReceiveAmount.toNumber() ==
                receiveAmount.toNumber()
        );
        assert.ok(
            _escrowAccount.initializerDepositTokenAccount.equals(
                initializerNftAccount
            )
        );
        assert.ok(
            _escrowAccount.initializerReceiveTokenAccount.equals(
                initializerTokenAccount
            )
        );
    });

    it("Can cancel escrow state", async () => {
        await program.methods
            .cancel()
            .accounts({
                vaultAccount: vault_account_pda,
                escrowAccount: escrowAccount.publicKey,
                initializerDepositTokenAccount: initializerNftAccount,
                vaultAuthority: vault_authority_pda,
                initializer: initializerMainAccount.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([initializerMainAccount])
            .rpc();

        const _initializerNftAccount = await getAccount(
            provider.connection,
            initializerNftAccount
        );

        assert.ok(
            _initializerNftAccount.owner.equals(
                initializerMainAccount.publicKey
            )
        );
        assert.ok(_initializerNftAccount.amount.toString() == "1");

        let deletedEscrowAccount =
            await program.account.escrowAccount.fetchNullable(
                escrowAccount.publicKey
            );

        assert.ok(deletedEscrowAccount == null);
    });

    it("Can exchange escrow state", async () => {
        await program.methods
            .initializeEscrow(receiveAmount)
            .accounts({
                vaultAccount: vault_account_pda,
                escrowAccount: escrowAccount.publicKey,
                initializer: initializerMainAccount.publicKey,
                initializerNftMint: nftMint,
                initializerDepositTokenAccount: initializerNftAccount,
                initializerReceiveMint: tokenMint,
                initializerReceiveTokenAccount: initializerTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .preInstructions([
                await program.account.escrowAccount.createInstruction(
                    escrowAccount
                ),
            ])
            .signers([escrowAccount, initializerMainAccount])
            .rpc();

        await program.methods
            .exchange()
            .accounts({
                escrowAccount: escrowAccount.publicKey,
                vaultAccount: vault_account_pda,
                vaultAuthority: vault_authority_pda,
                initializer: initializerMainAccount.publicKey,
                taker: takerMainAccount.publicKey,
                initializerDepositTokenAccount: initializerNftAccount,
                initializerReceiveTokenAccount: initializerTokenAccount,
                takerDepositTokenAccount: takerTokenAccount,
                takerReceiveTokenAccount: takerNftAccount,
                feeAccount: feeTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([takerMainAccount])
            .rpc();

        let _initializerNftAccount = await getAccount(
            provider.connection,
            initializerNftAccount
        );
        let _initializerTokenAccount = await getAccount(
            provider.connection,
            initializerTokenAccount
        );

        let _takerNftAccount = await getAccount(
            provider.connection,
            takerNftAccount
        );
        let _takerTokenAccount = await getAccount(
            provider.connection,
            takerTokenAccount
        );
        let _feeTokenAccount = await getAccount(
            provider.connection,
            feeTokenAccount
        );

        let feeLessReceiveAmount =
            receiveAmount.toNumber() - feeAmount.toNumber();

        assert.ok(_takerNftAccount.amount.toString() == "1");
        assert.ok(_takerTokenAccount.amount.toString() == "0");
        assert.ok(_initializerNftAccount.amount.toString() == "0");
        assert.ok(_feeTokenAccount.amount.toString() == feeAmount.toString());
        assert.ok(
            _initializerTokenAccount.amount.toString() ==
                feeLessReceiveAmount.toString()
        );

        let _escrowAccount = await program.account.escrowAccount.fetchNullable(
            escrowAccount.publicKey
        );

        assert.ok(_escrowAccount == null);
    });
});
