import { Event } from '../Event';
import { World } from '../World';
import { SLToken } from '../Contract/SLToken';
import { SLErc20Delegator } from '../Contract/SLErc20Delegator';
import { Erc20 } from '../Contract/Erc20';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  NumberV,
  Value,
  StringV
} from '../Value';
import { getWorldContractByAddress, getSLTokenAddress } from '../ContractLookup';

export async function getSLTokenV(world: World, event: Event): Promise<SLToken> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getSLTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<SLToken>(world, address.val);
}

export async function getSLErc20DelegatorV(world: World, event: Event): Promise<SLErc20Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getSLTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<SLErc20Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, slToken: SLToken): Promise<AddressV> {
  return new AddressV(await slToken.methods.interestRateModel().call());
}

async function slTokenAddress(world: World, slToken: SLToken): Promise<AddressV> {
  return new AddressV(slToken._address);
}

async function getSLTokenAdmin(world: World, slToken: SLToken): Promise<AddressV> {
  return new AddressV(await slToken.methods.admin().call());
}

async function getSLTokenPendingAdmin(world: World, slToken: SLToken): Promise<AddressV> {
  return new AddressV(await slToken.methods.pendingAdmin().call());
}

async function balanceOfUnderlying(world: World, slToken: SLToken, user: string): Promise<NumberV> {
  return new NumberV(await slToken.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, slToken: SLToken, user): Promise<NumberV> {
  return new NumberV(await slToken.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, slToken: SLToken, user): Promise<NumberV> {
  return new NumberV(await slToken.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.totalReserves().call());
}

async function getComptroller(world: World, slToken: SLToken): Promise<AddressV> {
  return new AddressV(await slToken.methods.comptroller().call());
}

async function getExchangeRateStored(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.getCash().call());
}

async function getInterestRate(world: World, slToken: SLToken): Promise<NumberV> {
  return new NumberV(await slToken.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, slToken: SLToken): Promise<AddressV> {
  return new AddressV(await (slToken as SLErc20Delegator).methods.implementation().call());
}

export function slTokenFetchers() {
  return [
    new Fetcher<{ slToken: SLToken }, AddressV>(`
        #### Address

        * "SLToken <SLToken> Address" - Returns address of SLToken contract
          * E.g. "SLToken slZRX Address" - Returns slZRX's address
      `,
      "Address",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => slTokenAddress(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, AddressV>(`
        #### InterestRateModel

        * "SLToken <SLToken> InterestRateModel" - Returns the interest rate model of SLToken contract
          * E.g. "SLToken slZRX InterestRateModel" - Returns slZRX's interest rate model
      `,
      "InterestRateModel",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getInterestRateModel(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, AddressV>(`
        #### Admin

        * "SLToken <SLToken> Admin" - Returns the admin of SLToken contract
          * E.g. "SLToken slZRX Admin" - Returns slZRX's admin
      `,
      "Admin",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getSLTokenAdmin(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, AddressV>(`
        #### PendingAdmin

        * "SLToken <SLToken> PendingAdmin" - Returns the pending admin of SLToken contract
          * E.g. "SLToken slZRX PendingAdmin" - Returns slZRX's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getSLTokenPendingAdmin(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, AddressV>(`
        #### Underlying

        * "SLToken <SLToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "SLToken slZRX Underlying"
      `,
      "Underlying",
      [
        new Arg("slToken", getSLTokenV)
      ],
      async (world, { slToken }) => new AddressV(await slToken.methods.underlying().call()),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken, address: AddressV }, NumberV>(`
        #### UnderlyingBalance

        * "SLToken <SLToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "SLToken slZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [
        new Arg("slToken", getSLTokenV),
        new Arg<AddressV>("address", getAddressV)
      ],
      (world, { slToken, address }) => balanceOfUnderlying(world, slToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken, address: AddressV }, NumberV>(`
        #### BorrowBalance

        * "SLToken <SLToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "SLToken slZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { slToken, address }) => getBorrowBalance(world, slToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken, address: AddressV }, NumberV>(`
        #### BorrowBalanceStored

        * "SLToken <SLToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "SLToken slZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { slToken, address }) => getBorrowBalanceStored(world, slToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### TotalBorrows

        * "SLToken <SLToken> TotalBorrows" - Returns the slToken's total borrow balance
          * E.g. "SLToken slZRX TotalBorrows"
      `,
      "TotalBorrows",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getTotalBorrows(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### TotalBorrowsCurrent

        * "SLToken <SLToken> TotalBorrowsCurrent" - Returns the slToken's total borrow balance with interest
          * E.g. "SLToken slZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getTotalBorrowsCurrent(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### Reserves

        * "SLToken <SLToken> Reserves" - Returns the slToken's total reserves
          * E.g. "SLToken slZRX Reserves"
      `,
      "Reserves",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getTotalReserves(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### ReserveFactor

        * "SLToken <SLToken> ReserveFactor" - Returns reserve factor of SLToken contract
          * E.g. "SLToken slZRX ReserveFactor" - Returns slZRX's reserve factor
      `,
      "ReserveFactor",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getReserveFactor(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, AddressV>(`
        #### Comptroller

        * "SLToken <SLToken> Comptroller" - Returns the slToken's comptroller
          * E.g. "SLToken slZRX Comptroller"
      `,
      "Comptroller",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getComptroller(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### ExchangeRateStored

        * "SLToken <SLToken> ExchangeRateStored" - Returns the slToken's exchange rate (based on balances stored)
          * E.g. "SLToken slZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getExchangeRateStored(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### ExchangeRate

        * "SLToken <SLToken> ExchangeRate" - Returns the slToken's current exchange rate
          * E.g. "SLToken slZRX ExchangeRate"
      `,
      "ExchangeRate",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getExchangeRate(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### Cash

        * "SLToken <SLToken> Cash" - Returns the slToken's current cash
          * E.g. "SLToken slZRX Cash"
      `,
      "Cash",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getCash(world, slToken),
      { namePos: 1 }
    ),

    new Fetcher<{ slToken: SLToken }, NumberV>(`
        #### InterestRate

        * "SLToken <SLToken> InterestRate" - Returns the slToken's current interest rate
          * E.g. "SLToken slZRX InterestRate"
      `,
      "InterestRate",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, {slToken}) => getInterestRate(world, slToken),
      {namePos: 1}
    ),
    new Fetcher<{slToken: SLToken, signature: StringV}, NumberV>(`
        #### CallNum

        * "SLToken <SLToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "SLToken slZRX Call \"borrowIndex()\""
      `,
      "CallNum",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("signature", getStringV),
      ],
      async (world, {slToken, signature}) => {
        const res = await world.web3.eth.call({
            to: slToken._address,
            data: world.web3.eth.abi.encodeFunctionSignature(signature.val)
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
      ,
      {namePos: 1}
    ),
    new Fetcher<{ slToken: SLToken }, AddressV>(`
        #### Implementation

        * "SLToken <SLToken> Implementation" - Returns the slToken's current implementation
          * E.g. "SLToken slDAI Implementation"
      `,
      "Implementation",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => getImplementation(world, slToken),
      { namePos: 1 }
    )
  ];
}

export async function getSLTokenValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("slToken", slTokenFetchers(), world, event);
}
