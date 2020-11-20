const {
  etherGasCost,
  etherMantissa,
  etherUnsigned,
  sendFallback
} = require('../Utils/Ethereum');

const {
  makeSLToken,
  balanceOf,
  fastForward,
  setBalance,
  setEtherBalance,
  getBalances,
  adjustBalances,
} = require('../Utils/SashimiLending');

const exchangeRate = 5;
const mintAmount = etherUnsigned(1e5);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = etherUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(slToken, minter, mintAmount, mintTokens, exchangeRate) {
  await send(slToken.comptroller, 'setMintAllowed', [true]);
  await send(slToken.comptroller, 'setMintVerify', [true]);
  await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintExplicit(slToken, minter, mintAmount) {
  return send(slToken, 'mint', [], {from: minter, value: mintAmount});
}

async function mintFallback(slToken, minter, mintAmount) {
  return sendFallback(slToken, {from: minter, value: mintAmount});
}

async function preRedeem(slToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await send(slToken.comptroller, 'setRedeemAllowed', [true]);
  await send(slToken.comptroller, 'setRedeemVerify', [true]);
  await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
  await setEtherBalance(slToken, redeemAmount);
  await send(slToken, 'harnessSetTotalSupply', [redeemTokens]);
  await setBalance(slToken, redeemer, redeemTokens);
}

async function redeemSLTokens(slToken, redeemer, redeemTokens, redeemAmount) {
  return send(slToken, 'redeem', [redeemTokens], {from: redeemer});
}

async function redeemUnderlying(slToken, redeemer, redeemTokens, redeemAmount) {
  return send(slToken, 'redeemUnderlying', [redeemAmount], {from: redeemer});
}

describe('SLEther', () => {
  let root, minter, redeemer, accounts;
  let slToken;

  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    slToken = await makeSLToken({kind: 'slether', comptrollerOpts: {kind: 'bool'}});
    await fastForward(slToken, 1);
  });

  [mintExplicit, mintFallback].forEach((mint) => {
    describe(mint.name, () => {
      beforeEach(async () => {
        await preMint(slToken, minter, mintAmount, mintTokens, exchangeRate);
      });

      it("reverts if interest accrual fails", async () => {
        await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(mint(slToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns success from mintFresh and mints the correct number of tokens", async () => {
        const beforeBalances = await getBalances([slToken], [minter]);
        const receipt = await mint(slToken, minter, mintAmount);
        const afterBalances = await getBalances([slToken], [minter]);
        expect(receipt).toSucceed();
        expect(mintTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [slToken, 'eth', mintAmount],
          [slToken, 'tokens', mintTokens],
          [slToken, minter, 'eth', -mintAmount.add(await etherGasCost(receipt))],
          [slToken, minter, 'tokens', mintTokens]
        ]));
      });
    });
  });

  [redeemSLTokens, redeemUnderlying].forEach((redeem) => {
    describe(redeem.name, () => {
      beforeEach(async () => {
        await preRedeem(slToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("emits a redeem failure if interest accrual fails", async () => {
        await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
        await expect(redeem(slToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      });

      it("returns error from redeemFresh without emitting any extra logs", async () => {
        expect(await redeem(slToken, redeemer, redeemTokens.mul(5), redeemAmount.mul(5))).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("returns success from redeemFresh and redeems the correct amount", async () => {
        await fastForward(slToken);
        const beforeBalances = await getBalances([slToken], [redeemer]);
        const receipt = await redeem(slToken, redeemer, redeemTokens, redeemAmount);
        expect(receipt).toTokenSucceed();
        const afterBalances = await getBalances([slToken], [redeemer]);
        expect(redeemTokens).not.toEqualNumber(0);
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [slToken, 'eth', -redeemAmount],
          [slToken, 'tokens', -redeemTokens],
          [slToken, redeemer, 'eth', redeemAmount.sub(await etherGasCost(receipt))],
          [slToken, redeemer, 'tokens', -redeemTokens]
        ]));
      });
    });
  });
});
