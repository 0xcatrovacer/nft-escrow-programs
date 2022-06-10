import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SystemProgram, Transaction } from "@solana/web3.js";
import {
    createMint,
    createAccount,
    mintTo,
    getAccount,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { EscrowContract } from "../target/types/escrow_contract";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

describe("escrow-contract", () => {
    const provider = anchor.AnchorProvider.local();

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

    const escrowAccount = anchor.web3.Keypair.generate();
    const payer = anchor.web3.Keypair.generate();
    const mintAuthority = anchor.web3.Keypair.generate();
    const initializerMainAccount = anchor.web3.Keypair.generate();
    const takerMainAccount = anchor.web3.Keypair.generate();

    const usdcDecimals = 1000000;

    const receiveAmount = new anchor.BN(100 * usdcDecimals);

    it("Initializes program state", async () => {
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                payer.publicKey,
                1000000000
            ),
            "processed"
        );

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

        await mintTo(
            provider.connection,
            payer,
            nftMint,
            initializerNftAccount,
            mintAuthority.publicKey,
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

        console.log(_initializerNftAccount);
        console.log(_takerNftAccount);
    });
});
