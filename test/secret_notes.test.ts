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

  it('4. multiple sequential unlocks increment the unlock_count correctly', () => {
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, validPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);
    const setupResult = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);

    // First unlock
    const unlock1 = contract.impureCircuits.unlock_note(setupResult.context, validPassphrase);
    const ledger1 = ledger(unlock1.context.currentQueryContext.state);
    expect(ledger1.unlock_count).toBe(1n);
    expect(ledger1.note_unlocked).toBe(true);

    // Second unlock
    const unlock2 = contract.impureCircuits.unlock_note(unlock1.context, validPassphrase);
    const ledger2 = ledger(unlock2.context.currentQueryContext.state);
    expect(ledger2.unlock_count).toBe(2n);

    // Third unlock
    const unlock3 = contract.impureCircuits.unlock_note(unlock2.context, validPassphrase);
    const ledger3 = ledger(unlock3.context.currentQueryContext.state);
    expect(ledger3.unlock_count).toBe(3n);
  });

  it('5. setup_note overwrites the previous note hash when called again', () => {
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, validPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);

    // First setup with noteHash
    const setup1 = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);
    const ledger1 = ledger(setup1.context.currentQueryContext.state);
    expect(ledger1.note_hash).toEqual(noteHash);

    // Second setup with different hash — should overwrite
    const differentHash = new Uint8Array(32).fill(88);
    const setup2 = contract.impureCircuits.setup_note(setup1.context, differentHash);
    const ledger2 = ledger(setup2.context.currentQueryContext.state);
    expect(ledger2.note_hash).toEqual(differentHash);
    // Unlock count should be reset to 0 after new setup
    expect(ledger2.unlock_count).toBe(0n);
    expect(ledger2.note_unlocked).toBe(false);
  });

  it('6. setup_note followed by unlock resets state correctly on re-setup', () => {
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, validPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);
    const setup1 = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);
    const unlock1 = contract.impureCircuits.unlock_note(setup1.context, validPassphrase);

    // Verify unlocked state
    const afterUnlock = ledger(unlock1.context.currentQueryContext.state);
    expect(afterUnlock.note_unlocked).toBe(true);
    expect(afterUnlock.unlock_count).toBe(1n);

    // Re-setup with new hash — should reset all state
    const newHash = new Uint8Array(32).fill(55);
    const setup2 = contract.impureCircuits.setup_note(unlock1.context, newHash);
    const afterResetup = ledger(setup2.context.currentQueryContext.state);
    expect(afterResetup.note_unlocked).toBe(false);
    expect(afterResetup.unlock_count).toBe(0n);
    expect(afterResetup.note_hash).toEqual(newHash);
  });

  it('7. unlock_note returns true as the result value on success', () => {
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, validPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);
    const setupResult = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);
    const unlockResult = contract.impureCircuits.unlock_note(setupResult.context, validPassphrase);

    // The circuit returns `disclose(note_unlocked)` which should be true
    expect(unlockResult.result).toBe(true);
  });

  it('8. note_hash persists across multiple unlock operations', () => {
    const contract = new Contract({
      passphrase: (ctx) => [ctx.privateState, validPassphrase],
    });

    const initialCircuitCtx = getInitialCircuitContext(contract);
    const setupResult = contract.impureCircuits.setup_note(initialCircuitCtx, noteHash);

    // Unlock multiple times and verify hash doesn't change
    const unlock1 = contract.impureCircuits.unlock_note(setupResult.context, validPassphrase);
    const unlock2 = contract.impureCircuits.unlock_note(unlock1.context, validPassphrase);

    const finalLedger = ledger(unlock2.context.currentQueryContext.state);
    expect(finalLedger.note_hash).toEqual(noteHash);
    expect(finalLedger.unlock_count).toBe(2n);
  });
});
