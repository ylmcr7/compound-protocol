const {
  etherGasCost,
  etherUnsigned
} = require('../Utils/Ethereum');

const {
  makeSLToken,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  pretendBorrow,
  preApprove
} = require('../Utils/SashimiLending');

const repayAmount = etherUnsigned(10e2);
const seizeAmount = repayAmount;
const seizeTokens = seizeAmount.mul(4); // forced

async function preLiquidate(slToken, liquidator, borrower, repayAmount, slTokenCollateral) {
  // setup for success in liquidating
  await send(slToken.comptroller, 'setLiquidateBorrowAllowed', [true]);
  await send(slToken.comptroller, 'setLiquidateBorrowVerify', [true]);
  await send(slToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(slToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(slToken.comptroller, 'setSeizeAllowed', [true]);
  await send(slToken.comptroller, 'setSeizeVerify', [true]);
  await send(slToken.comptroller, 'setFailCalculateSeizeTokens', [false]);
  await send(slToken.underlying, 'harnessSetFailTransferFromAddress', [liquidator, false]);
  await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slTokenCollateral.comptroller, 'setCalculatedSeizeTokens', [seizeTokens]);
  await setBalance(slTokenCollateral, liquidator, 0);
  await setBalance(slTokenCollateral, borrower, seizeTokens);
  await pretendBorrow(slTokenCollateral, borrower, 0, 1, 0);
  await pretendBorrow(slToken, borrower, 1, 1, repayAmount);
  await preApprove(slToken, liquidator, repayAmount);
}

async function liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral) {
  return send(slToken, 'harnessLiquidateBorrowFresh', [liquidator, borrower, repayAmount, slTokenCollateral._address]);
}

async function liquidate(slToken, liquidator, borrower, repayAmount, slTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(slToken, 1);
  await fastForward(slTokenCollateral, 1);
  return send(slToken, 'liquidateBorrow', [borrower, repayAmount, slTokenCollateral._address], {from: liquidator});
}

async function seize(slToken, liquidator, borrower, seizeAmount) {
  return send(slToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('SLToken', function () {
  let root, liquidator, borrower, accounts;
  let slToken, slTokenCollateral;

  beforeEach(async () => {
    [root, liquidator, borrower, ...accounts] = saddle.accounts;
    slToken = await makeSLToken({comptrollerOpts: {kind: 'bool'}});
    slTokenCollateral = await makeSLToken({comptroller: slToken.comptroller});
  });

  beforeEach(async () => {
    await preLiquidate(slToken, liquidator, borrower, repayAmount, slTokenCollateral);
  });

  describe('liquidateBorrowFresh', () => {
    it("fails if comptroller tells it to", async () => {
      await send(slToken.comptroller, 'setLiquidateBorrowAllowed', [false]);
      expect(
        await liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      expect(
        await liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(slToken);
      expect(
        await liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_FRESHNESS_CHECK');
    });

    it("fails if collateral market not fresh", async () => {
      await fastForward(slToken);
      await fastForward(slTokenCollateral);
      await send(slToken, 'accrueInterest');
      expect(
        await liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_COLLATERAL_FRESHNESS_CHECK');
    });

    it("fails if borrower is equal to liquidator", async () => {
      expect(
        await liquidateFresh(slToken, borrower, borrower, repayAmount, slTokenCollateral)
      ).toHaveTokenFailure('INVALID_ACCOUNT_PAIR', 'LIQUIDATE_LIQUIDATOR_IS_BORROWER');
    });

    it("fails if repayAmount = 0", async () => {
      expect(await liquidateFresh(slToken, liquidator, borrower, 0, slTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("fails if calculating seize tokens fails and does not adjust balances", async () => {
      const beforeBalances = await getBalances([slToken, slTokenCollateral], [liquidator, borrower]);
      await send(slToken.comptroller, 'setFailCalculateSeizeTokens', [true]);
      await expect(
        liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).rejects.toRevert('revert LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED');
      const afterBalances = await getBalances([slToken, slTokenCollateral], [liquidator, borrower]);
      expect(afterBalances).toEqual(beforeBalances);
    });

    it("fails if repay fails", async () => {
      await send(slToken.comptroller, 'setRepayBorrowAllowed', [false]);
      expect(
        await liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_REPAY_BORROW_FRESH_FAILED');
    });

    it("reverts if seize fails", async () => {
      await send(slToken.comptroller, 'setSeizeAllowed', [false]);
      await expect(
        liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).rejects.toRevert("revert token seizure failed");
    });

    it("reverts if liquidateBorrowVerify fails", async() => {
      await send(slToken.comptroller, 'setLiquidateBorrowVerify', [false]);
      await expect(
        liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral)
      ).rejects.toRevert("revert liquidateBorrowVerify rejected liquidateBorrow");
    });

    it("transfers the cash, borrows, tokens, and emits Transfer, LiquidateBorrow events", async () => {
      const beforeBalances = await getBalances([slToken, slTokenCollateral], [liquidator, borrower]);
      const result = await liquidateFresh(slToken, liquidator, borrower, repayAmount, slTokenCollateral);
      const afterBalances = await getBalances([slToken, slTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('LiquidateBorrow', {
        liquidator: liquidator,
        borrower: borrower,
        repayAmount: repayAmount.toString(),
        slTokenCollateral: slTokenCollateral._address,
        seizeTokens: seizeTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 0], {
        from: liquidator,
        to: slToken._address,
        amount: repayAmount.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [slToken, 'cash', repayAmount],
        [slToken, 'borrows', -repayAmount],
        [slToken, liquidator, 'cash', -repayAmount],
        [slTokenCollateral, liquidator, 'tokens', seizeTokens],
        [slToken, borrower, 'borrows', -repayAmount],
        [slTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('liquidateBorrow', () => {
    it("emits a liquidation failure if borrowed asset interest accrual fails", async () => {
      await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(slToken, liquidator, borrower, repayAmount, slTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("emits a liquidation failure if collateral asset interest accrual fails", async () => {
      await send(slTokenCollateral.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(slToken, liquidator, borrower, repayAmount, slTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from liquidateBorrowFresh without emitting any extra logs", async () => {
      expect(await liquidate(slToken, liquidator, borrower, 0, slTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("returns success from liquidateBorrowFresh and transfers the correct amounts", async () => {
      const beforeBalances = await getBalances([slToken, slTokenCollateral], [liquidator, borrower]);
      const result = await liquidate(slToken, liquidator, borrower, repayAmount, slTokenCollateral);
      const gasCost = await etherGasCost(result);
      const afterBalances = await getBalances([slToken, slTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [slToken, 'cash', repayAmount],
        [slToken, 'borrows', -repayAmount],
        [slToken, liquidator, 'eth', -gasCost],
        [slToken, liquidator, 'cash', -repayAmount],
        [slTokenCollateral, liquidator, 'eth', -gasCost],
        [slTokenCollateral, liquidator, 'tokens', seizeTokens],
        [slToken, borrower, 'borrows', -repayAmount],
        [slTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('seize', () => {
    // XXX verify callers are properly checked

    it("fails if seize is not allowed", async () => {
      await send(slToken.comptroller, 'setSeizeAllowed', [false]);
      expect(await seize(slTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTrollReject('LIQUIDATE_SEIZE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("fails if slTokenBalances[borrower] < amount", async () => {
      await setBalance(slTokenCollateral, borrower, 1);
      expect(await seize(slTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED', 'INTEGER_UNDERFLOW');
    });

    it("fails if slTokenBalances[liquidator] overflows", async () => {
      await setBalance(slTokenCollateral, liquidator, -1);
      expect(await seize(slTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED', 'INTEGER_OVERFLOW');
    });

    it("succeeds, updates balances, and emits Transfer event", async () => {
      const beforeBalances = await getBalances([slTokenCollateral], [liquidator, borrower]);
      const result = await seize(slTokenCollateral, liquidator, borrower, seizeTokens);
      const afterBalances = await getBalances([slTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Transfer', {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [slTokenCollateral, liquidator, 'tokens', seizeTokens],
        [slTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });
});
