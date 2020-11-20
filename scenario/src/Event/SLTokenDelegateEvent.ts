import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { SLToken, SLTokenScenario } from '../Contract/SLToken';
import { SLErc20Delegate } from '../Contract/SLErc20Delegate'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { getSLTokenDelegateData } from '../ContractLookup';
import { buildSLTokenDelegate } from '../Builder/SLTokenDelegateBuilder';
import { verify } from '../Verify';

async function genSLTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, slTokenDelegate, delegateData } = await buildSLTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added slToken ${delegateData.name} (${delegateData.contract}) at address ${slTokenDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifySLTokenDelegate(world: World, slTokenDelegate: SLErc20Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, slTokenDelegate._address);
  }

  return world;
}

export function slTokenDelegateCommands() {
  return [
    new Command<{ slTokenDelegateParams: EventV }>(`
        #### Deploy

        * "SLTokenDelegate Deploy ...slTokenDelegateParams" - Generates a new SLTokenDelegate
          * E.g. "SLTokenDelegate Deploy CDaiDelegate cDAIDelegate"
      `,
      "Deploy",
      [new Arg("slTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { slTokenDelegateParams }) => genSLTokenDelegate(world, from, slTokenDelegateParams.val)
    ),
    new View<{ slTokenDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "SLTokenDelegate <slTokenDelegate> Verify apiKey:<String>" - Verifies SLTokenDelegate in Etherscan
          * E.g. "SLTokenDelegate slDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("slTokenDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { slTokenDelegateArg, apiKey }) => {
        let [slToken, name, data] = await getSLTokenDelegateData(world, slTokenDelegateArg.val);

        return await verifySLTokenDelegate(world, slToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processSLTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("SLTokenDelegate", slTokenDelegateCommands(), world, event, from);
}
