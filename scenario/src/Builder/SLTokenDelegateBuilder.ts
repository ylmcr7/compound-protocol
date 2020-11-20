import { Event } from '../Event';
import { World } from '../World';
import { SLErc20Delegate, SLErc20DelegateScenario } from '../Contract/SLErc20Delegate';
import { SLToken } from '../Contract/SLToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const SLDaiDelegateContract = getContract('SLDaiDelegate');
const SLDaiDelegateScenarioContract = getTestContract('SLDaiDelegateScenario');
const SLErc20DelegateContract = getContract('SLErc20Delegate');
const SLErc20DelegateScenarioContract = getTestContract('SLErc20DelegateScenario');


export interface SLTokenDelegateData {
  invokation: Invokation<SLErc20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildSLTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; slTokenDelegate: SLErc20Delegate; delegateData: SLTokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, SLTokenDelegateData>(
      `
        #### SLDaiDelegate

        * "SLDaiDelegate name:<String>"
          * E.g. "SLTokenDelegate Deploy SLDaiDelegate slDAIDelegate"
      `,
      'SLDaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SLDaiDelegateContract.deploy<SLErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'SLDaiDelegate',
          description: 'Standard SLDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, SLTokenDelegateData>(
      `
        #### SLDaiDelegateScenario

        * "SLDaiDelegateScenario name:<String>" - A SLDaiDelegate Scenario for local testing
          * E.g. "SLTokenDelegate Deploy SLDaiDelegateScenario slDAIDelegate"
      `,
      'SLDaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SLDaiDelegateScenarioContract.deploy<SLErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'SLDaiDelegateScenario',
          description: 'Scenario SLDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, SLTokenDelegateData>(
      `
        #### SLErc20Delegate

        * "SLErc20Delegate name:<String>"
          * E.g. "SLTokenDelegate Deploy SLErc20Delegate slDAIDelegate"
      `,
      'SLErc20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SLErc20DelegateContract.deploy<SLErc20Delegate>(world, from, []),
          name: name.val,
          contract: 'SLErc20Delegate',
          description: 'Standard SLErc20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, SLTokenDelegateData>(
      `
        #### SLErc20DelegateScenario

        * "SLErc20DelegateScenario name:<String>" - A SLErc20Delegate Scenario for local testing
          * E.g. "SLTokenDelegate Deploy SLErc20DelegateScenario slDAIDelegate"
      `,
      'SLErc20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await SLErc20DelegateScenarioContract.deploy<SLErc20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'SLErc20DelegateScenario',
          description: 'Scenario SLErc20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, SLTokenDelegateData>("DeploySLToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const slTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    slTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['SLTokenDelegate', delegateData.name],
        data: {
          address: slTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, slTokenDelegate, delegateData };
}
