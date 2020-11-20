const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeSLToken,
  balanceOf,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  preApprove,
  quickMint,
  preSupply,
  quickRedeem,
  quickRedeemUnderlying
} = require('../Utils/SashimiLending');

const exchangeRate = 50e3;
const mintAmount = etherUnsigned(10e4);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = etherUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(slToken, minter, mintAmount, mintTokens, exchangeRate) {
  await preApprove(slToken, minter, mintAmount);
  await send(slToken.comptroller, 'setMintAllowed', [true]);
  await send(slToken.comptroller, 'setMintVerify', [true]);
  await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slToken.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(slToken, 'harnessSetBalance', [minter, 0]);
  await send(slToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function mintFresh(slToken, minter, mintAmount) {
  return send(slToken, 'harnessMintFresh', [minter, mintAmount]);
}

async function preRedeem(slToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await preSupply(slToken, redeemer, redeemTokens);
  await send(slToken.comptroller, 'setRedeemAllowed', [true]);
  await send(slToken.comptroller, 'setRedeemVerify', [true]);
  await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slToken.underlying, 'harnessSetBalance', [slToken._address, redeemAmount]);
  await send(slToken.underlying, 'harnessSetBalance', [redeemer, 0]);
  await send(slToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, false]);
  await send(slToken, 'harnessSetExchangeRate', [etherMantissa(exchangeRate)]);
}

async function redeemFreshTokens(slToken, redeemer, redeemTokens, redeemAmount) {
  return send(slToken, 'harnessRedeemFresh', [redeemer, redeemTokens, 0]);
}

async function redeemFreshAmount(slToken, redeemer, redeemTokens, redeemAmount) {
  return send(slToken, 'harnessRedeemFresh', [redeemer, 0, redeemAmount]);
}

describe('SLToken', function () {
  let root, minter, redeemer, accounts;
  let slToken;
  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    slToken = await makeSLToken({comptrollerOpts: {kind: 'bool'}, exchangeRate});
  });

  describe('mintFresh', () => {
    beforeEach(async () => {
      await preMint(slToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("fails if comptroller tells it to", async () => {
      await send(slToken.comptroller, 'setMintAllowed', [false]);
      expect(await mintFresh(slToken, minter, mintAmount)).toHaveTrollReject('MINT_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await mintFresh(slToken, minter, mintAmount)).toSucceed();
    });

    it("fails if not fresh", async () => {
      await fastForward(slToken);
      expect(await mintFresh(slToken, minter, mintAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'MINT_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(slToken, 'accrueInterest')).toSucceed();
      expect(await mintFresh(slToken, minter, mintAmount)).toSucceed();
    });

    it("fails if insufficient approval", async () => {
      expect(
        await send(slToken.underlying, 'approve', [slToken._address, 1], {from: minter})
      ).toSucceed();
      await expect(mintFresh(slToken, minter, mintAmount)).rejects.toRevert('revert Insufficient allowance');
    });

    it("fails if insufficient balance", async() => {
      await setBalance(slToken.underlying, minter, 1);
      await expect(mintFresh(slToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("proceeds if sufficient approval and balance", async () =>{
      expect(await mintFresh(slToken, minter, mintAmount)).toSucceed();
    });

    it("fails if exchange calculation fails", async () => {
      expect(await send(slToken, 'harnessSetExchangeRate', [0])).toSucceed();
      await expect(mintFresh(slToken, minter, mintAmount)).rejects.toRevert('revert MINT_EXCHANGE_CALCULATION_FAILED');
    });

    it("fails if transferring in fails", async () => {
      await send(slToken.underlying, 'harnessSetFailTransferFromAddress', [minter, true]);
      await expect(mintFresh(slToken, minter, mintAmount)).rejects.toRevert('revert TOKEN_TRANSFER_IN_FAILED');
    });

    it("transfers the underlying cash, tokens, and emits Mint, Transfer events", async () => {
      const beforeBalances = await getBalances([slToken], [minter]);
      const result = await mintFresh(slToken, minter, mintAmount);
      const afterBalances = await getBalances([slToken], [minter]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Mint', {
        minter,
        mintAmount: mintAmount.toString(),
        mintTokens: mintTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: slToken._address,
        to: minter,
        amount: mintTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [slToken, minter, 'cash', -mintAmount],
        [slToken, minter, 'tokens', mintTokens],
        [slToken, 'cash', mintAmount],
        [slToken, 'tokens', mintTokens]
      ]));
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await preMint(slToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("emits a mint failure if interest accrual fails", async () => {
      await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickMint(slToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from mintFresh without emitting any extra logs", async () => {
      await send(slToken.underlying, 'harnessSetBalance', [minter, 1]);
      await expect(mintFresh(slToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from mintFresh and mints the correct number of tokens", async () => {
      expect(await quickMint(slToken, minter, mintAmount)).toSucceed();
      expect(mintTokens).not.toEqualNumber(0);
      expect(await balanceOf(slToken, minter)).toEqualNumber(mintTokens);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(slToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "0",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });

  [redeemFreshTokens, redeemFreshAmount].forEach((redeemFresh) => {
    describe(redeemFresh.name, () => {
      beforeEach(async () => {
        await preRedeem(slToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("fails if comptroller tells it to", async () =>{
        await send(slToken.comptroller, 'setRedeemAllowed', [false]);
        expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toHaveTrollReject('REDEEM_COMPTROLLER_REJECTION');
      });

      it("fails if not fresh", async () => {
        await fastForward(slToken);
        expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDEEM_FRESHNESS_CHECK');
      });

      it("continues if fresh", async () => {
        await expect(await send(slToken, 'accrueInterest')).toSucceed();
        expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toSucceed();
      });

      it("fails if insufficient protocol cash to transfer out", async() => {
        await send(slToken.underlying, 'harnessSetBalance', [slToken._address, 1]);
        expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
      });

      it("fails if exchange calculation fails", async () => {
        if (redeemFresh == redeemFreshTokens) {
          expect(await send(slToken, 'harnessSetExchangeRate', [-1])).toSucceed();
          expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_TOKENS_CALCULATION_FAILED');
        } else {
          expect(await send(slToken, 'harnessSetExchangeRate', [0])).toSucceed();
          expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_AMOUNT_CALCULATION_FAILED');
        }
      });

      it("fails if transferring out fails", async () => {
        await send(slToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, true]);
        await expect(redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
      });

      it("fails if total supply < redemption amount", async () => {
        await send(slToken, 'harnessExchangeRateDetails', [0, 0, 0]);
        expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("reverts if new account balance underflows", async () => {
        await send(slToken, 'harnessSetBalance', [redeemer, 0]);
        expect(await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED');
      });

      it("transfers the underlying cash, tokens, and emits Redeem, Transfer events", async () => {
        const beforeBalances = await getBalances([slToken], [redeemer]);
        const result = await redeemFresh(slToken, redeemer, redeemTokens, redeemAmount);
        const afterBalances = await getBalances([slToken], [redeemer]);
        expect(result).toSucceed();
        expect(result).toHaveLog('Redeem', {
          redeemer,
          redeemAmount: redeemAmount.toString(),
          redeemTokens: redeemTokens.toString()
        });
        expect(result).toHaveLog(['Transfer', 1], {
          from: redeemer,
          to: slToken._address,
          amount: redeemTokens.toString()
        });
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [slToken, redeemer, 'cash', redeemAmount],
          [slToken, redeemer, 'tokens', -redeemTokens],
          [slToken, 'cash', -redeemAmount],
          [slToken, 'tokens', -redeemTokens]
        ]));
      });
    });
  });

  describe('redeem', () => {
    beforeEach(async () => {
      await preRedeem(slToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
    });

    it("emits a redeem failure if interest accrual fails", async () => {
      await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickRedeem(slToken, redeemer, redeemTokens)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from redeemFresh without emitting any extra logs", async () => {
      await setBalance(slToken.underlying, slToken._address, 0);
      expect(await quickRedeem(slToken, redeemer, redeemTokens, {exchangeRate})).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
    });

    it("returns success from redeemFresh and redeems the right amount", async () => {
      expect(
        await send(slToken.underlying, 'harnessSetBalance', [slToken._address, redeemAmount])
      ).toSucceed();
      expect(await quickRedeem(slToken, redeemer, redeemTokens, {exchangeRate})).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(slToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("returns success from redeemFresh and redeems the right amount of underlying", async () => {
      expect(
        await send(slToken.underlying, 'harnessSetBalance', [slToken._address, redeemAmount])
      ).toSucceed();
      expect(
        await quickRedeemUnderlying(slToken, redeemer, redeemAmount, {exchangeRate})
      ).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(slToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(slToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "500000000",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });
});
