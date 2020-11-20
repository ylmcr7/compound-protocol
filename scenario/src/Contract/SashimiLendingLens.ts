import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface SashimiLendingLensMethods {
  slTokenBalances(slToken: string, account: string): Sendable<[string,number,number,number,number,number]>;
  slTokenBalancesAll(cTokens: string[], account: string): Sendable<[string,number,number,number,number,number][]>;
  slTokenMetadata(slToken: string): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number]>;
  slTokenMetadataAll(cTokens: string[]): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number][]>;
  slTokenUnderlyingPrice(slToken: string): Sendable<[string,number]>;
  slTokenUnderlyingPriceAll(cTokens: string[]): Sendable<[string,number][]>;
  getAccountLimits(comptroller: string, account: string): Sendable<[string[],number,number]>;
}

export interface SashimiLendingLens extends Contract {
  methods: SashimiLendingLensMethods;
  name: string;
}
