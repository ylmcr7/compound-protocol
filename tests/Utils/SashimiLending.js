"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  etherBalance,
  etherMantissa,
  etherUnsigned,
  mergeInterface
} = require('./Ethereum');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    return await deploy('BoolComptroller');
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setMaxAssets', [maxAssets]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller-g3') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG3');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const sashimiRate = etherUnsigned(dfn(opts.sashimiRate, 1e18));
    const sashimiMarkets = opts.sashimiMarkets || [];
    const otherMarkets = opts.otherMarkets || [];

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address, sashimiRate, sashimiMarkets, otherMarkets]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(unitroller, { priceOracle });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = etherMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = etherUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = etherMantissa(1);
    const sashimi = opts.sashimi || await deploy('SashimiToken');
    const sashimiRate = etherUnsigned(dfn(opts.sashimiRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setSashimiAddress', [sashimi._address]); // harness only
    await send(unitroller, '_setSashimiRate', [sashimiRate]);

    return Object.assign(unitroller, { priceOracle, sashimi });
  }
}

async function makeSLToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'slerc20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = etherMantissa(dfn(opts.exchangeRate, 1));
  const decimals = etherUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'slether' ? 'slETH' : 'slOMG');
  const name = opts.name || `SLToken ${symbol}`;
  const admin = opts.admin || root;

  let slToken, underlying;
  let slDelegator, slDelegatee, slDaiMaker;

  switch (kind) {
    case 'slether':
      slToken = await deploy('SLEtherHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'sldai':
      slDaiMaker  = await deploy('SLDaiDelegateMakerHarness');
      underlying = slDaiMaker;
      slDelegatee = await deploy('SLDaiDelegateHarness');
      slDelegator = await deploy('SLErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          slDelegatee._address,
          encodeParameters(['address', 'address'], [slDaiMaker._address, slDaiMaker._address])
        ]
      );
      slToken = await saddle.getContractAt('SLDaiDelegateHarness', slDelegator._address); // XXXS at
      break;

    case 'slerc20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      slDelegatee = await deploy('SLErc20DelegateHarness');
      slDelegator = await deploy('SLErc20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          slDelegatee._address,
          "0x0"
        ]
      );
      slToken = await saddle.getContractAt('SLErc20DelegateHarness', slDelegator._address); // XXXS at
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [slToken._address]);
  }

  if (opts.addCompMarket) {
    await send(comptroller, '_addSashimiMarket', [slToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = etherMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [slToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = etherMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [slToken._address, factor])).toSucceed();
  }

  return Object.assign(slToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = etherMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = etherMantissa(dfn(opts.baseRate, 0));
    const multiplier = etherMantissa(dfn(opts.multiplier, 1e-18));
    const jump = etherMantissa(dfn(opts.jump, 0));
    const kink = etherMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'erc20'
  } = opts || {};

  if (kind == 'erc20') {
    const quantity = etherUnsigned(dfn(opts.quantity, 1e25));
    const decimals = etherUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Erc20 ${symbol}`;
    return await deploy('ERC20Harness', [quantity, name, decimals, symbol]);
  }
}

async function balanceOf(token, account) {
  return etherUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return etherUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(slToken, account) {
  const { principal, interestIndex } = await call(slToken, 'harnessAccountBorrows', [account]);
  return { principal: etherUnsigned(principal), interestIndex: etherUnsigned(interestIndex) };
}

async function totalBorrows(slToken) {
  return etherUnsigned(await call(slToken, 'totalBorrows'));
}

async function totalReserves(slToken) {
  return etherUnsigned(await call(slToken, 'totalReserves'));
}

async function enterMarkets(slTokens, from) {
  return await send(slTokens[0].comptroller, 'enterMarkets', [slTokens.map(sl => sl._address)], { from });
}

async function fastForward(slToken, blocks = 5) {
  return await send(slToken, 'harnessFastForward', [blocks]);
}

async function setBalance(slToken, account, balance) {
  return await send(slToken, 'harnessSetBalance', [account, balance]);
}

async function setEtherBalance(slEther, balance) {
  const current = await etherBalance(slEther._address);
  const root = saddle.account;
  expect(await send(slEther, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(slEther, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(slTokens, accounts) {
  const balances = {};
  for (let slToken of slTokens) {
    const cBalances = balances[slToken._address] = {};
    for (let account of accounts) {
      cBalances[account] = {
        eth: await etherBalance(account),
        cash: slToken.underlying && await balanceOf(slToken.underlying, account),
        tokens: await balanceOf(slToken, account),
        borrows: (await borrowSnapshot(slToken, account)).principal
      };
    }
    cBalances[slToken._address] = {
      eth: await etherBalance(slToken._address),
      cash: slToken.underlying && await balanceOf(slToken.underlying, slToken._address),
      tokens: await totalSupply(slToken),
      borrows: await totalBorrows(slToken),
      reserves: await totalReserves(slToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let slToken, account, key, diff;
    if (delta.length == 4) {
      ([slToken, account, key, diff] = delta);
    } else {
      ([slToken, key, diff] = delta);
      account = slToken._address;
    }
    balances[slToken._address][account][key] = balances[slToken._address][account][key].add(diff);
  }
  return balances;
}


async function preApprove(slToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(slToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(slToken.underlying, 'approve', [slToken._address, amount], { from });
}

async function quickMint(slToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(slToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(slToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(slToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(slToken, 'mint', [mintAmount], { from: minter });
}


async function preSupply(slToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(slToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(slToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(slToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(slToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(slToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(slToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(slToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(slToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(slToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(slToken, 'harnessSetExchangeRate', [etherMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(slToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(slToken, price) {
  return send(slToken.comptroller.priceOracle, 'setUnderlyingPrice', [slToken._address, etherMantissa(price)]);
}

async function setBorrowRate(slToken, rate) {
  return send(slToken.interestRateModel, 'setBorrowRate', [etherMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(etherUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(etherUnsigned));
}

async function pretendBorrow(slToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(slToken, 'harnessSetTotalBorrows', [etherUnsigned(principalRaw)]);
  await send(slToken, 'harnessSetAccountBorrows', [borrower, etherUnsigned(principalRaw), etherMantissa(accountIndex)]);
  await send(slToken, 'harnessSetBorrowIndex', [etherMantissa(marketIndex)]);
  await send(slToken, 'harnessSetAccrualBlockNumber', [etherUnsigned(blockNumber)]);
  await send(slToken, 'harnessSetBlockNumber', [etherUnsigned(blockNumber)]);
}

module.exports = {
  makeComptroller,
  makeSLToken,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,

  preApprove,
  quickMint,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow
};
