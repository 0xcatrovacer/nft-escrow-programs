import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { EscrowContract } from "../target/types/escrow_contract";

describe("escrow-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.EscrowContract as Program<EscrowContract>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
