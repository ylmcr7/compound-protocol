import { Event } from '../Event';
import { World } from '../World';
import { SLErc20Delegate } from '../Contract/SLErc20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getSLTokenDelegateAddress } from '../ContractLookup';

export async function getSLTokenDelegateV(world: World, event: Event): Promise<SLErc20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getSLTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<SLErc20Delegate>(world, address.val);
}

async function slTokenDelegateAddress(world: World, slTokenDelegate: SLErc20Delegate): Promise<AddressV> {
  return new AddressV(slTokenDelegate._address);
}

export function slTokenDelegateFetchers() {
  return [
    new Fetcher<{ slTokenDelegate: SLErc20Delegate }, AddressV>(`
        #### Address

        * "SLTokenDelegate <SLTokenDelegate> Address" - Returns address of SLTokenDelegate contract
          * E.g. "SLTokenDelegate slDaiDelegate Address" - Returns slDaiDelegate's address
      `,
      "Address",
      [
        new Arg("slTokenDelegate", getSLTokenDelegateV)
      ],
      (world, { slTokenDelegate }) => slTokenDelegateAddress(world, slTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getSLTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("SLTokenDelegate", slTokenDelegateFetchers(), world, event);
}
