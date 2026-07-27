import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  passphrase(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  setup_note(context: __compactRuntime.CircuitContext<PS>,
             initial_hash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  unlock_note(context: __compactRuntime.CircuitContext<PS>,
              provided_passphrase_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  setup_note(context: __compactRuntime.CircuitContext<PS>,
             initial_hash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  unlock_note(context: __compactRuntime.CircuitContext<PS>,
              provided_passphrase_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  setup_note(context: __compactRuntime.CircuitContext<PS>,
             initial_hash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  unlock_note(context: __compactRuntime.CircuitContext<PS>,
              provided_passphrase_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  readonly note_unlocked: boolean;
  readonly note_hash: Uint8Array;
  readonly unlock_count: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
