import { describe, it, expect } from 'vitest';
import { Contract, ledger } from '../managed/contract/index.js';
import { createCircuitContext, dummyContractAddress } from '@midnight-ntwrk/compact-runtime';

describe('Midnight-ZKSecretNotes Smart Contract', () => {
  const validPassphrase = new Uint8Array(32).fill(7);
  const noteHash = new Uint8Array(32).fill(42);
  const coinPublicKey = { bytes: new Uint8Array(32) };

  function getInitialCircuitContext(contract: Contract<any>) {
    const initResult = contract.initialState({
      initialPrivateState: {},
      initialZswapLocalState: {
        coinPublicKey,
        currentIndex: 0n,
        inputs: [],
        outputs: []
      }
    });
    return createCircuitContext(
      dummyContractAddress(),
      coinPublicKey,
      initResult.currentContractState.data,
      initResult.currentPrivateState
    );
  }

  it('1. setup_note initializes the public ledger state correctly', () => {
    let currentPassphrase = validPassphrase;
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, currentPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);
    const setupResult = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);

    const currentLedger = ledger(setupResult.context.currentQueryContext.state);
    expect(currentLedger.note_unlocked).toBe(false);
    expect(currentLedger.unlock_count).toBe(0n);
    expect(currentLedger.note_hash).toEqual(noteHash);
  });

  it('2. unlock_note succeeds with matching passphrase witness and updates ledger state', () => {
    let currentPassphrase = validPassphrase;
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, currentPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);
    const setupResult = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);

    const unlockResult = contract.impureCircuits.unlock_note(setupResult.context, validPassphrase);

    expect(unlockResult.result).toBe(true);

    const updatedLedger = ledger(unlockResult.context.currentQueryContext.state);
    expect(updatedLedger.note_unlocked).toBe(true);
    expect(updatedLedger.unlock_count).toBe(1n);
  });

  it('3. unlock_note rejects invalid passphrase via ZK circuit assertion failure', () => {
    const wrongPassphrase = new Uint8Array(32).fill(99);
    
    // Witness returns wrong secret passphrase
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, wrongPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);
    const setupResult = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);

    expect(() => {
      contract.impureCircuits.unlock_note(setupResult.context, validPassphrase);
    }).toThrow();
  });
});
