const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeSLToken,
  balanceOf,
  borrowSnapshot,
  totalBorrows,
  fastForward,
  setBalance,
  preApprove,
  pretendBorrow
} = require('../Utils/SashimiLending');

const borrowAmount = etherUnsigned(10e3);
const repayAmount = etherUnsigned(10e2);

async function preBorrow(slToken, borrower, borrowAmount) {
  await send(slToken.comptroller, 'setBorrowAllowed', [true]);
  await send(slToken.comptroller, 'setBorrowVerify', [true]);
  await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slToken.underlying, 'harnessSetBalance', [slToken._address, borrowAmount]);
  await send(slToken, 'harnessSetFailTransferToAddress', [borrower, false]);
  await send(slToken, 'harnessSetAccountBorrows', [borrower, 0, 0]);
  await send(slToken, 'harnessSetTotalBorrows', [0]);
}

async function borrowFresh(slToken, borrower, borrowAmount) {
  return send(slToken, 'harnessBorrowFresh', [borrower, borrowAmount]);
}

async function borrow(slToken, borrower, borrowAmount, opts = {}) {
  // make sure to have a block delta so we accrue interest
  await send(slToken, 'harnessFastForward', [1]);
  return send(slToken, 'borrow', [borrowAmount], {from: borrower});
}

async function preRepay(slToken, benefactor, borrower, repayAmount) {
  // setup either benefactor OR borrower for success in repaying
  await send(slToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(slToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(slToken.underlying, 'harnessSetFailTransferFromAddress', [benefactor, false]);
  await send(slToken.underlying, 'harnessSetFailTransferFromAddress', [borrower, false]);
  await pretendBorrow(slToken, borrower, 1, 1, repayAmount);
  await preApprove(slToken, benefactor, repayAmount);
  await preApprove(slToken, borrower, repayAmount);
}

async function repayBorrowFresh(slToken, payer, borrower, repayAmount) {
  return send(slToken, 'harnessRepayBorrowFresh', [payer, borrower, repayAmount], {from: payer});
}

async function repayBorrow(slToken, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(slToken, 'harnessFastForward', [1]);
  return send(slToken, 'repayBorrow', [repayAmount], {from: borrower});
}

async function repayBorrowBehalf(slToken, payer, borrower, repayAmount) {
  // make sure to have a block delta so we accrue interest
  await send(slToken, 'harnessFastForward', [1]);
  return send(slToken, 'repayBorrowBehalf', [borrower, repayAmount], {from: payer});
}

describe('SLToken', function () {
  let slToken, root, borrower, benefactor, accounts;
  beforeEach(async () => {
    [root, borrower, benefactor, ...accounts] = saddle.accounts;
    slToken = await makeSLToken({comptrollerOpts: {kind: 'bool'}});
  });

  describe('borrowFresh', () => {
    beforeEach(async () => await preBorrow(slToken, borrower, borrowAmount));

    it("fails if comptroller tells it to", async () => {
      await send(slToken.comptroller, 'setBorrowAllowed', [false]);
      expect(await borrowFresh(slToken, borrower, borrowAmount)).toHaveTrollReject('BORROW_COMPTROLLER_REJECTION');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await borrowFresh(slToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(slToken);
      expect(await borrowFresh(slToken, borrower, borrowAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'BORROW_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(slToken, 'accrueInterest')).toSucceed();
      await expect(await borrowFresh(slToken, borrower, borrowAmount)).toSucceed();
    });

    it("fails if error if protocol has less than borrowAmount of underlying", async () => {
      expect(await borrowFresh(slToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("fails if borrowBalanceStored fails (due to non-zero stored principal with zero account index)", async () => {
      await pretendBorrow(slToken, borrower, 0, 3e18, 5e18);
      expect(await borrowFresh(slToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_ACCUMULATED_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculating account new total borrow balance overflows", async () => {
      await pretendBorrow(slToken, borrower, 1e-18, 1e-18, -1);
      expect(await borrowFresh(slToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED');
    });

    it("fails if calculation of new total borrow balance overflows", async () => {
      await send(slToken, 'harnessSetTotalBorrows', [-1]);
      expect(await borrowFresh(slToken, borrower, borrowAmount)).toHaveTokenFailure('MATH_ERROR', 'BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED');
    });

    it("reverts if transfer out fails", async () => {
      await send(slToken, 'harnessSetFailTransferToAddress', [borrower, true]);
      await expect(borrowFresh(slToken, borrower, borrowAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
    });

    it("reverts if borrowVerify fails", async() => {
      await send(slToken.comptroller, 'setBorrowVerify', [false]);
      await expect(borrowFresh(slToken, borrower, borrowAmount)).rejects.toRevert("revert borrowVerify rejected borrow");
    });

    it("transfers the underlying cash, tokens, and emits Transfer, Borrow events", async () => {
      const beforeProtocolCash = await balanceOf(slToken.underlying, slToken._address);
      const beforeProtocolBorrows = await totalBorrows(slToken);
      const beforeAccountCash = await balanceOf(slToken.underlying, borrower);
      const result = await borrowFresh(slToken, borrower, borrowAmount);
      expect(result).toSucceed();
      expect(await balanceOf(slToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
      expect(await balanceOf(slToken.underlying, slToken._address)).toEqualNumber(beforeProtocolCash.sub(borrowAmount));
      expect(await totalBorrows(slToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
      expect(result).toHaveLog('Transfer', {
        from: slToken._address,
        to: borrower,
        amount: borrowAmount.toString()
      });
      expect(result).toHaveLog('Borrow', {
        borrower: borrower,
        borrowAmount: borrowAmount.toString(),
        accountBorrows: borrowAmount.toString(),
        totalBorrows: beforeProtocolBorrows.add(borrowAmount).toString()
      });
    });

    it("stores new borrow principal and interest index", async () => {
      const beforeProtocolBorrows = await totalBorrows(slToken);
      await pretendBorrow(slToken, borrower, 0, 3, 0);
      await borrowFresh(slToken, borrower, borrowAmount);
      const borrowSnap = await borrowSnapshot(slToken, borrower);
      expect(borrowSnap.principal).toEqualNumber(borrowAmount);
      expect(borrowSnap.interestIndex).toEqualNumber(etherMantissa(3));
      expect(await totalBorrows(slToken)).toEqualNumber(beforeProtocolBorrows.add(borrowAmount));
    });
  });

  describe('borrow', () => {
    beforeEach(async () => await preBorrow(slToken, borrower, borrowAmount));

    it("emits a borrow failure if interest accrual fails", async () => {
      await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(borrow(slToken, borrower, borrowAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from borrowFresh without emitting any extra logs", async () => {
      expect(await borrow(slToken, borrower, borrowAmount.add(1))).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'BORROW_CASH_NOT_AVAILABLE');
    });

    it("returns success from borrowFresh and transfers the correct amount", async () => {
      const beforeAccountCash = await balanceOf(slToken.underlying, borrower);
      await fastForward(slToken);
      expect(await borrow(slToken, borrower, borrowAmount)).toSucceed();
      expect(await balanceOf(slToken.underlying, borrower)).toEqualNumber(beforeAccountCash.add(borrowAmount));
    });
  });

  describe('repayBorrowFresh', () => {
    [true, false].forEach((benefactorIsPayer) => {
      let payer;
      const label = benefactorIsPayer ? "benefactor paying" : "borrower paying";
      describe(label, () => {
        beforeEach(async () => {
          payer = benefactorIsPayer ? benefactor : borrower;
          await preRepay(slToken, payer, borrower, repayAmount);
        });

        it("fails if repay is not allowed", async () => {
          await send(slToken.comptroller, 'setRepayBorrowAllowed', [false]);
          expect(await repayBorrowFresh(slToken, payer, borrower, repayAmount)).toHaveTrollReject('REPAY_BORROW_COMPTROLLER_REJECTION', 'MATH_ERROR');
        });

        it("fails if block number ≠ current block number", async () => {
          await fastForward(slToken);
          expect(await repayBorrowFresh(slToken, payer, borrower, repayAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REPAY_BORROW_FRESHNESS_CHECK');
        });

        it("fails if insufficient approval", async() => {
          await preApprove(slToken, payer, 1);
          await expect(repayBorrowFresh(slToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient allowance');
        });

        it("fails if insufficient balance", async() => {
          await setBalance(slToken.underlying, payer, 1);
          await expect(repayBorrowFresh(slToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
        });


        it("returns an error if calculating account new account borrow balance fails", async () => {
          await pretendBorrow(slToken, borrower, 1, 1, 1);
          await expect(repayBorrowFresh(slToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_ACCOUNT_BORROW_BALANCE_CALCULATION_FAILED");
        });

        it("returns an error if calculation of new total borrow balance fails", async () => {
          await send(slToken, 'harnessSetTotalBorrows', [1]);
          await expect(repayBorrowFresh(slToken, payer, borrower, repayAmount)).rejects.toRevert("revert REPAY_BORROW_NEW_TOTAL_BALANCE_CALCULATION_FAILED");
        });


        it("reverts if doTransferIn fails", async () => {
          await send(slToken.underlying, 'harnessSetFailTransferFromAddress', [payer, true]);
          await expect(repayBorrowFresh(slToken, payer, borrower, repayAmount)).rejects.toRevert("revert TOKEN_TRANSFER_IN_FAILED");
        });

        it("reverts if repayBorrowVerify fails", async() => {
          await send(slToken.comptroller, 'setRepayBorrowVerify', [false]);
          await expect(repayBorrowFresh(slToken, payer, borrower, repayAmount)).rejects.toRevert("revert repayBorrowVerify rejected repayBorrow");
        });

        it("transfers the underlying cash, and emits Transfer, RepayBorrow events", async () => {
          const beforeProtocolCash = await balanceOf(slToken.underlying, slToken._address);
          const result = await repayBorrowFresh(slToken, payer, borrower, repayAmount);
          expect(await balanceOf(slToken.underlying, slToken._address)).toEqualNumber(beforeProtocolCash.add(repayAmount));
          expect(result).toHaveLog('Transfer', {
            from: payer,
            to: slToken._address,
            amount: repayAmount.toString()
          });
          expect(result).toHaveLog('RepayBorrow', {
            payer: payer,
            borrower: borrower,
            repayAmount: repayAmount.toString(),
            accountBorrows: "0",
            totalBorrows: "0"
          });
        });

        it("stores new borrow principal and interest index", async () => {
          const beforeProtocolBorrows = await totalBorrows(slToken);
          const beforeAccountBorrowSnap = await borrowSnapshot(slToken, borrower);
          expect(await repayBorrowFresh(slToken, payer, borrower, repayAmount)).toSucceed();
          const afterAccountBorrows = await borrowSnapshot(slToken, borrower);
          expect(afterAccountBorrows.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
          expect(afterAccountBorrows.interestIndex).toEqualNumber(etherMantissa(1));
          expect(await totalBorrows(slToken)).toEqualNumber(beforeProtocolBorrows.sub(repayAmount));
        });
      });
    });
  });

  describe('repayBorrow', () => {
    beforeEach(async () => {
      await preRepay(slToken, borrower, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrow(slToken, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(slToken.underlying, borrower, 1);
      await expect(repayBorrow(slToken, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(slToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(slToken, borrower);
      expect(await repayBorrow(slToken, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(slToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });

    it("repays the full amount owed if payer has enough", async () => {
      await fastForward(slToken);
      expect(await repayBorrow(slToken, borrower, -1)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(slToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(0);
    });

    it("fails gracefully if payer does not have enough", async () => {
      await setBalance(slToken.underlying, borrower, 3);
      await fastForward(slToken);
      await expect(repayBorrow(slToken, borrower, -1)).rejects.toRevert('revert Insufficient balance');
    });
  });

  describe('repayBorrowBehalf', () => {
    let payer;

    beforeEach(async () => {
      payer = benefactor;
      await preRepay(slToken, payer, borrower, repayAmount);
    });

    it("emits a repay borrow failure if interest accrual fails", async () => {
      await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(repayBorrowBehalf(slToken, payer, borrower, repayAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from repayBorrowFresh without emitting any extra logs", async () => {
      await setBalance(slToken.underlying, payer, 1);
      await expect(repayBorrowBehalf(slToken, payer, borrower, repayAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from repayBorrowFresh and repays the right amount", async () => {
      await fastForward(slToken);
      const beforeAccountBorrowSnap = await borrowSnapshot(slToken, borrower);
      expect(await repayBorrowBehalf(slToken, payer, borrower, repayAmount)).toSucceed();
      const afterAccountBorrowSnap = await borrowSnapshot(slToken, borrower);
      expect(afterAccountBorrowSnap.principal).toEqualNumber(beforeAccountBorrowSnap.principal.sub(repayAmount));
    });
  });
});
