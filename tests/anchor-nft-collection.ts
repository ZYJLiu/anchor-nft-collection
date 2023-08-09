import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { AnchorNftCollection } from "../target/types/anchor_nft_collection";
import {
  Metadata,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import { Metaplex } from "@metaplex-foundation/js";
import { assert } from "chai";

describe("anchor-nft-collection", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .AnchorNftCollection as Program<AnchorNftCollection>;

  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const metaplex = Metaplex.make(connection);

  const testMetadata = {
    uri: "https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ",
    name: "NAME",
    symbol: "SYMBOL",
  };

  const [collectionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("Collection")],
    program.programId
  );

  it("create collection nft", async () => {
    const collectionMetadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: collectionPDA });

    const collectionMasterEditionPDA = await metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: collectionPDA });

    const collectionTokenAccount = await spl.getAssociatedTokenAddress(
      collectionPDA,
      wallet.publicKey
    );

    const modifyComputeUnits =
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });

    const tx = await program.methods
      .createCollectionNft(
        testMetadata.uri,
        testMetadata.name,
        testMetadata.symbol
      )
      .accounts({
        authority: wallet.publicKey,
        collectionMint: collectionPDA,
        metadataAccount: collectionMetadataPDA,
        masterEdition: collectionMasterEditionPDA,
        tokenAccount: collectionTokenAccount,
        tokenMetadataProgram: METADATA_PROGRAM_ID,
      })
      .transaction();

    const transferTransaction = new anchor.web3.Transaction().add(
      modifyComputeUnits,
      tx
    );

    const txSig = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transferTransaction,
      [wallet.payer],
      { skipPreflight: true }
    );

    // check metadata account has expected data
    const accInfo = await connection.getAccountInfo(collectionMetadataPDA);
    const metadata = Metadata.deserialize(accInfo.data, 0);

    assert.ok(
      metadata[0].data.uri.startsWith(testMetadata.uri),
      "URI in metadata does not start with expected URI"
    );
    assert.ok(
      metadata[0].data.name.startsWith(testMetadata.name),
      "Name in metadata does not start with expected name"
    );
    assert.ok(
      metadata[0].data.symbol.startsWith(testMetadata.symbol),
      "Symbol in metadata does not start with expected symbol"
    );

    assert.isTrue(
      metadata[0].data.creators[0].address.equals(wallet.publicKey)
    );
    assert.isTrue(metadata[0].data.creators[0].verified);
    assert.isTrue(metadata[0].collectionDetails.__kind === "V1");
  });

  it("create nft in collection", async () => {
    const mint = anchor.web3.Keypair.generate();

    const metadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: mint.publicKey });

    const masterEditionPDA = await metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: mint.publicKey });

    const tokenAccount = await spl.getAssociatedTokenAddress(
      mint.publicKey,
      wallet.publicKey
    );

    const collectionMetadataPDA = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: collectionPDA });

    const collectionMasterEditionPDA = await metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: collectionPDA });

    const modifyComputeUnits =
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });

    const tx = await program.methods
      .createNftInCollection(
        testMetadata.uri,
        testMetadata.name,
        testMetadata.symbol
      )
      .accounts({
        user: wallet.publicKey,
        collectionMint: collectionPDA,
        collectionMetadataAccount: collectionMetadataPDA,
        collectionMasterEdition: collectionMasterEditionPDA,
        nftMint: mint.publicKey,
        metadataAccount: metadataPDA,
        masterEdition: masterEditionPDA,
        tokenAccount: tokenAccount,
        tokenMetadataProgram: METADATA_PROGRAM_ID,
      })
      .transaction();

    const transferTransaction = new anchor.web3.Transaction().add(
      modifyComputeUnits,
      tx
    );

    const txSig = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transferTransaction,
      [wallet.payer, mint],
      { skipPreflight: true }
    );

    // check metadata account has expected data
    const accInfo = await connection.getAccountInfo(metadataPDA);
    const metadata = Metadata.deserialize(accInfo.data, 0);

    assert.ok(
      metadata[0].data.uri.startsWith(testMetadata.uri),
      "URI in metadata does not start with expected URI"
    );
    assert.ok(
      metadata[0].data.name.startsWith(testMetadata.name),
      "Name in metadata does not start with expected name"
    );
    assert.ok(
      metadata[0].data.symbol.startsWith(testMetadata.symbol),
      "Symbol in metadata does not start with expected symbol"
    );

    assert.isTrue(metadata[0].collection.key.equals(collectionPDA));
    assert.isTrue(metadata[0].collection.verified);
  });
});
