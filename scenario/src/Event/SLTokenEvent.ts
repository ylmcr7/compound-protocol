import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { SLToken, SLTokenScenario } from '../Contract/SLToken';
import { SLErc20Delegate } from '../Contract/SLErc20Delegate'
import { SLErc20Delegator } from '../Contract/SLErc20Delegator'
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
import { getContract } from '../Contract';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { SLTokenErrorReporter } from '../ErrorReporter';
import { getComptroller, getSLTokenData } from '../ContractLookup';
import { getExpMantissa } from '../Encoding';
import { buildSLToken } from '../Builder/SLTokenBuilder';
import { verify } from '../Verify';
import { getLiquidity } from '../Value/ComptrollerValue';
import { encodedNumber } from '../Encoding';
import { getSLTokenV, getSLErc20DelegatorV } from '../Value/SLTokenValue';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genSLToken(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, slToken, tokenData } = await buildSLToken(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added slToken ${tokenData.name} (${tokenData.contract}<decimals=${tokenData.decimals}>) at address ${slToken._address}`,
    tokenData.invokation
  );

  return world;
}

async function accrueInterest(world: World, from: string, slToken: SLToken): Promise<World> {
  let invokation = await invoke(world, slToken.methods.accrueInterest(), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: Interest accrued`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, slToken: SLToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, slToken.methods.mint(amount.encode()), from, SLTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, slToken.methods.mint(), from, SLTokenErrorReporter);
  }

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} mints ${showAmount}`,
    invokation
  );

  return world;
}

async function redeem(world: World, from: string, slToken: SLToken, tokens: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods.redeem(tokens.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} redeems ${tokens.show()} tokens`,
    invokation
  );

  return world;
}

async function redeemUnderlying(world: World, from: string, slToken: SLToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods.redeemUnderlying(amount.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} redeems ${amount.show()} underlying`,
    invokation
  );

  return world;
}

async function borrow(world: World, from: string, slToken: SLToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods.borrow(amount.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repayBorrow(world: World, from: string, slToken: SLToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, slToken.methods.repayBorrow(amount.encode()), from, SLTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, slToken.methods.repayBorrow(), from, SLTokenErrorReporter);
  }

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}

async function repayBorrowBehalf(world: World, from: string, behalf: string, slToken: SLToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, slToken.methods.repayBorrowBehalf(behalf, amount.encode()), from, SLTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, slToken.methods.repayBorrowBehalf(behalf), from, SLTokenErrorReporter);
  }

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow on behalf of ${describeUser(world, behalf)}`,
    invokation
  );

  return world;
}

async function liquidateBorrow(world: World, from: string, slToken: SLToken, borrower: string, collateral: SLToken, repayAmount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (repayAmount instanceof NumberV) {
    showAmount = repayAmount.show();
    invokation = await invoke(world, slToken.methods.liquidateBorrow(borrower, repayAmount.encode(), collateral._address), from, SLTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, slToken.methods.liquidateBorrow(borrower, collateral._address), from, SLTokenErrorReporter);
  }

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

async function seize(world: World, from: string, slToken: SLToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods.seize(liquidator, borrower, seizeTokens.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} initiates seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function evilSeize(world: World, from: string, slToken: SLToken, treasure: SLToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods.evilSeize(treasure._address, liquidator, borrower, seizeTokens.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} initiates illegal seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function setPendingAdmin(world: World, from: string, slToken: SLToken, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, slToken.methods._setPendingAdmin(newPendingAdmin), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, slToken: SLToken): Promise<World> {
  let invokation = await invoke(world, slToken.methods._acceptAdmin(), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function addReserves(world: World, from: string, slToken: SLToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods._addReserves(amount.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} adds to reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function reduceReserves(world: World, from: string, slToken: SLToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods._reduceReserves(amount.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} reduces reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function setReserveFactor(world: World, from: string, slToken: SLToken, reserveFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, slToken.methods._setReserveFactor(reserveFactor.encode()), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(world, from)} sets reserve factor to ${reserveFactor.show()}`,
    invokation
  );

  return world;
}

async function setInterestRateModel(world: World, from: string, slToken: SLToken, interestRateModel: string): Promise<World> {
  let invokation = await invoke(world, slToken.methods._setInterestRateModel(interestRateModel), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `Set interest rate for ${slToken.name} to ${interestRateModel} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setComptroller(world: World, from: string, slToken: SLToken, comptroller: string): Promise<World> {
  let invokation = await invoke(world, slToken.methods._setComptroller(comptroller), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `Set comptroller for ${slToken.name} to ${comptroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function becomeImplementation(
  world: World,
  from: string,
  slToken: SLToken,
  becomeImplementationData: string
): Promise<World> {

  const slErc20Delegate = getContract('SLErc20Delegate');
  const slErc20DelegateContract = await slErc20Delegate.at<SLErc20Delegate>(world, slToken._address);

  let invokation = await invoke(
    world,
    slErc20DelegateContract.methods._becomeImplementation(becomeImplementationData),
    from,
    SLTokenErrorReporter
  );

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(
      world,
      from
    )} initiates _becomeImplementation with data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function resignImplementation(
  world: World,
  from: string,
  slToken: SLToken,
): Promise<World> {

  const slErc20Delegate = getContract('SLErc20Delegate');
  const slErc20DelegateContract = await slErc20Delegate.at<SLErc20Delegate>(world, slToken._address);

  let invokation = await invoke(
    world,
    slErc20DelegateContract.methods._resignImplementation(),
    from,
    SLTokenErrorReporter
  );

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(
      world,
      from
    )} initiates _resignImplementation.`,
    invokation
  );

  return world;
}

async function setImplementation(
  world: World,
  from: string,
  slToken: SLErc20Delegator,
  implementation: string,
  allowResign: boolean,
  becomeImplementationData: string
): Promise<World> {
  let invokation = await invoke(
    world,
    slToken.methods._setImplementation(
      implementation,
      allowResign,
      becomeImplementationData
    ),
    from,
    SLTokenErrorReporter
  );

  world = addAction(
    world,
    `SLToken ${slToken.name}: ${describeUser(
      world,
      from
    )} initiates setImplementation with implementation:${implementation} allowResign:${allowResign} data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function donate(world: World, from: string, slToken: SLToken): Promise<World> {
  let invokation = await invoke(world, slToken.methods.donate(), from, SLTokenErrorReporter);

  world = addAction(
    world,
    `Donate for ${slToken.name} as ${describeUser(world, from)} with value ${showTrxValue(world)}`,
    invokation
  );

  return world;
}

async function setSLTokenMock(world: World, from: string, slToken: SLTokenScenario, mock: string, value: NumberV): Promise<World> {
  let mockMethod: (number) => Sendable<void>;

  switch (mock.toLowerCase()) {
    case "totalborrows":
      mockMethod = slToken.methods.setTotalBorrows;
      break;
    case "totalreserves":
      mockMethod = slToken.methods.setTotalReserves;
      break;
    default:
      throw new Error(`Mock "${mock}" not defined for slToken`);
  }

  let invokation = await invoke(world, mockMethod(value.encode()), from);

  world = addAction(
    world,
    `Mocked ${mock}=${value.show()} for ${slToken.name}`,
    invokation
  );

  return world;
}

async function verifySLToken(world: World, slToken: SLToken, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, slToken._address);
  }

  return world;
}

async function printMinters(world: World, slToken: SLToken): Promise<World> {
  let events = await getPastEvents(world, slToken, slToken.name, 'Mint');
  let addresses = events.map((event) => event.returnValues['minter']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Minters:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printBorrowers(world: World, slToken: SLToken): Promise<World> {
  let events = await getPastEvents(world, slToken, slToken.name, 'Borrow');
  let addresses = events.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Borrowers:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printLiquidity(world: World, slToken: SLToken): Promise<World> {
  let mintEvents = await getPastEvents(world, slToken, slToken.name, 'Mint');
  let mintAddresses = mintEvents.map((event) => event.returnValues['minter']);
  let borrowEvents = await getPastEvents(world, slToken, slToken.name, 'Borrow');
  let borrowAddresses = borrowEvents.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(mintAddresses.concat(borrowAddresses))];
  let comptroller = await getComptroller(world);

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

export function slTokenCommands() {
  return [
    new Command<{ slTokenParams: EventV }>(`
        #### Deploy

        * "SLToken Deploy ...slTokenParams" - Generates a new SLToken
          * E.g. "SLToken slZRX Deploy"
      `,
      "Deploy",
      [new Arg("slTokenParams", getEventV, { variadic: true })],
      (world, from, { slTokenParams }) => genSLToken(world, from, slTokenParams.val)
    ),
    new View<{ slTokenArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "SLToken <slToken> Verify apiKey:<String>" - Verifies SLToken in Etherscan
          * E.g. "SLToken slZRX Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("slTokenArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { slTokenArg, apiKey }) => {
        let [slToken, name, data] = await getSLTokenData(world, slTokenArg.val);

        return await verifySLToken(world, slToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken }>(`
        #### AccrueInterest

        * "SLToken <slToken> AccrueInterest" - Accrues interest for given token
          * E.g. "SLToken slZRX AccrueInterest"
      `,
      "AccrueInterest",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, from, { slToken }) => accrueInterest(world, from, slToken),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, amount: NumberV | NothingV }>(`
        #### Mint

        * "SLToken <slToken> Mint amount:<Number>" - Mints the given amount of slToken as specified user
          * E.g. "SLToken slZRX Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { slToken, amount }) => mint(world, from, slToken, amount),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, tokens: NumberV }>(`
        #### Redeem

        * "SLToken <slToken> Redeem tokens:<Number>" - Redeems the given amount of slTokens as specified user
          * E.g. "SLToken slZRX Redeem 1.0e9"
      `,
      "Redeem",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("tokens", getNumberV)
      ],
      (world, from, { slToken, tokens }) => redeem(world, from, slToken, tokens),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, amount: NumberV }>(`
        #### RedeemUnderlying

        * "SLToken <slToken> RedeemUnderlying amount:<Number>" - Redeems the given amount of underlying as specified user
          * E.g. "SLToken slZRX RedeemUnderlying 1.0e18"
      `,
      "RedeemUnderlying",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { slToken, amount }) => redeemUnderlying(world, from, slToken, amount),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, amount: NumberV }>(`
        #### Borrow

        * "SLToken <slToken> Borrow amount:<Number>" - Borrows the given amount of this slToken as specified user
          * E.g. "SLToken slZRX Borrow 1.0e18"
      `,
      "Borrow",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { slToken, amount }) => borrow(world, from, slToken, amount),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, amount: NumberV | NothingV }>(`
        #### RepayBorrow

        * "SLToken <slToken> RepayBorrow underlyingAmount:<Number>" - Repays borrow in the given underlying amount as specified user
          * E.g. "SLToken slZRX RepayBorrow 1.0e18"
      `,
      "RepayBorrow",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { slToken, amount }) => repayBorrow(world, from, slToken, amount),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, behalf: AddressV, amount: NumberV | NothingV }>(`
        #### RepayBorrowBehalf

        * "SLToken <slToken> RepayBorrowBehalf behalf:<User> underlyingAmount:<Number>" - Repays borrow in the given underlying amount on behalf of another user
          * E.g. "SLToken slZRX RepayBorrowBehalf Geoff 1.0e18"
      `,
      "RepayBorrowBehalf",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("behalf", getAddressV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { slToken, behalf, amount }) => repayBorrowBehalf(world, from, behalf.val, slToken, amount),
      { namePos: 1 }
    ),
    new Command<{ borrower: AddressV, slToken: SLToken, collateral: SLToken, repayAmount: NumberV | NothingV }>(`
        #### Liquidate

        * "SLToken <slToken> Liquidate borrower:<User> slTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of given token seizing collateral token
          * E.g. "SLToken slZRX Liquidate Geoff cBAT 1.0e18"
      `,
      "Liquidate",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getSLTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { borrower, slToken, collateral, repayAmount }) => liquidateBorrow(world, from, slToken, borrower.val, collateral, repayAmount),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### Seize

        * "SLToken <slToken> Seize liquidator:<User> borrower:<User> seizeTokens:<Number>" - Seizes a given number of tokens from a user (to be called from other SLToken)
          * E.g. "SLToken slZRX Seize Geoff Torrey 1.0e18"
      `,
      "Seize",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { slToken, liquidator, borrower, seizeTokens }) => seize(world, from, slToken, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, treasure: SLToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### EvilSeize

        * "SLToken <slToken> EvilSeize treasure:<Token> liquidator:<User> borrower:<User> seizeTokens:<Number>" - Improperly seizes a given number of tokens from a user
          * E.g. "SLToken slEVL EvilSeize slZRX Geoff Torrey 1.0e18"
      `,
      "EvilSeize",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("treasure", getSLTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { slToken, treasure, liquidator, borrower, seizeTokens }) => evilSeize(world, from, slToken, treasure, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, amount: NumberV }>(`
        #### ReduceReserves

        * "SLToken <slToken> ReduceReserves amount:<Number>" - Reduces the reserves of the slToken
          * E.g. "SLToken slZRX ReduceReserves 1.0e18"
      `,
      "ReduceReserves",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { slToken, amount }) => reduceReserves(world, from, slToken, amount),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, amount: NumberV }>(`
    #### AddReserves

    * "SLToken <slToken> AddReserves amount:<Number>" - Adds reserves to the slToken
      * E.g. "SLToken slZRX AddReserves 1.0e18"
  `,
      "AddReserves",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { slToken, amount }) => addReserves(world, from, slToken, amount),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, newPendingAdmin: AddressV }>(`
        #### SetPendingAdmin

        * "SLToken <slToken> SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the slToken
          * E.g. "SLToken slZRX SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, { slToken, newPendingAdmin }) => setPendingAdmin(world, from, slToken, newPendingAdmin.val),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken }>(`
        #### AcceptAdmin

        * "SLToken <slToken> AcceptAdmin" - Accepts admin for the slToken
          * E.g. "From Geoff (SLToken slZRX AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, from, { slToken }) => acceptAdmin(world, from, slToken),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, reserveFactor: NumberV }>(`
        #### SetReserveFactor

        * "SLToken <slToken> SetReserveFactor reserveFactor:<Number>" - Sets the reserve factor for the slToken
          * E.g. "SLToken slZRX SetReserveFactor 0.1"
      `,
      "SetReserveFactor",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("reserveFactor", getExpNumberV)
      ],
      (world, from, { slToken, reserveFactor }) => setReserveFactor(world, from, slToken, reserveFactor),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, interestRateModel: AddressV }>(`
        #### SetInterestRateModel

        * "SLToken <slToken> SetInterestRateModel interestRateModel:<Contract>" - Sets the interest rate model for the given slToken
          * E.g. "SLToken slZRX SetInterestRateModel (FixedRate 1.5)"
      `,
      "SetInterestRateModel",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("interestRateModel", getAddressV)
      ],
      (world, from, { slToken, interestRateModel }) => setInterestRateModel(world, from, slToken, interestRateModel.val),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, comptroller: AddressV }>(`
        #### SetComptroller

        * "SLToken <slToken> SetComptroller comptroller:<Contract>" - Sets the comptroller for the given slToken
          * E.g. "SLToken slZRX SetComptroller Comptroller"
      `,
      "SetComptroller",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("comptroller", getAddressV)
      ],
      (world, from, { slToken, comptroller }) => setComptroller(world, from, slToken, comptroller.val),
      { namePos: 1 }
    ),
    new Command<{
      slToken: SLToken;
      becomeImplementationData: StringV;
    }>(
      `
        #### BecomeImplementation

        * "SLToken <slToken> BecomeImplementation becomeImplementationData:<String>"
          * E.g. "SLToken slDAI BecomeImplementation "0x01234anyByTeS56789""
      `,
      'BecomeImplementation',
      [
        new Arg('slToken', getSLTokenV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { slToken, becomeImplementationData }) =>
        becomeImplementation(
          world,
          from,
          slToken,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{slToken: SLToken;}>(
      `
        #### ResignImplementation

        * "SLToken <slToken> ResignImplementation"
          * E.g. "SLToken slDAI ResignImplementation"
      `,
      'ResignImplementation',
      [new Arg('slToken', getSLTokenV)],
      (world, from, { slToken }) =>
        resignImplementation(
          world,
          from,
          slToken
        ),
      { namePos: 1 }
    ),
    new Command<{
      slToken: SLErc20Delegator;
      implementation: AddressV;
      allowResign: BoolV;
      becomeImplementationData: StringV;
    }>(
      `
        #### SetImplementation

        * "SLToken <slToken> SetImplementation implementation:<Address> allowResign:<Bool> becomeImplementationData:<String>"
          * E.g. "SLToken slDAI SetImplementation (SLToken slDAIDelegate Address) True "0x01234anyByTeS56789"
      `,
      'SetImplementation',
      [
        new Arg('slToken', getSLErc20DelegatorV),
        new Arg('implementation', getAddressV),
        new Arg('allowResign', getBoolV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { slToken, implementation, allowResign, becomeImplementationData }) =>
        setImplementation(
          world,
          from,
          slToken,
          implementation.val,
          allowResign.val,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken }>(`
        #### Donate

        * "SLToken <slToken> Donate" - Calls the donate (payable no-op) function
          * E.g. "(Trx Value 5.0e18 (SLToken slETH Donate))"
      `,
      "Donate",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, from, { slToken }) => donate(world, from, slToken),
      { namePos: 1 }
    ),
    new Command<{ slToken: SLToken, variable: StringV, value: NumberV }>(`
        #### Mock

        * "SLToken <slToken> Mock variable:<String> value:<Number>" - Mocks a given value on slToken. Note: value must be a supported mock and this will only work on a "SLTokenScenario" contract.
          * E.g. "SLToken slZRX Mock totalBorrows 5.0e18"
          * E.g. "SLToken slZRX Mock totalReserves 0.5e18"
      `,
      "Mock",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("variable", getStringV),
        new Arg("value", getNumberV),
      ],
      (world, from, { slToken, variable, value }) => setSLTokenMock(world, from, <SLTokenScenario>slToken, variable.val, value),
      { namePos: 1 }
    ),
    new View<{ slToken: SLToken }>(`
        #### Minters

        * "SLToken <slToken> Minters" - Print address of all minters
      `,
      "Minters",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => printMinters(world, slToken),
      { namePos: 1 }
    ),
    new View<{ slToken: SLToken }>(`
        #### Borrowers

        * "SLToken <slToken> Borrowers" - Print address of all borrowers
      `,
      "Borrowers",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => printBorrowers(world, slToken),
      { namePos: 1 }
    ),
    new View<{ slToken: SLToken }>(`
        #### Liquidity

        * "SLToken <slToken> Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("slToken", getSLTokenV)
      ],
      (world, { slToken }) => printLiquidity(world, slToken),
      { namePos: 1 }
    ),
    new View<{ slToken: SLToken, input: StringV }>(`
        #### Decode

        * "Decode <slToken> input:<String>" - Prints information about a call to a slToken contract
      `,
      "Decode",
      [
        new Arg("slToken", getSLTokenV),
        new Arg("input", getStringV)

      ],
      (world, { slToken, input }) => decodeCall(world, slToken, input.val),
      { namePos: 1 }
    )
  ];
}

export async function processSLTokenEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("SLToken", slTokenCommands(), world, event, from);
}
