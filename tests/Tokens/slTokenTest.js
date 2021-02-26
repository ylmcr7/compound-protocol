const {
  etherUnsigned,
  etherMantissa
} = require('../Utils/Ethereum');

const {
  makeSLToken,
  setBorrowRate,
  pretendBorrow
} = require('../Utils/SashimiLending');

describe('SLToken', function () {
  let root, admin, accounts;
  beforeEach(async () => {
    [root, admin, ...accounts] = saddle.accounts;
  });

  describe('constructor', () => {
    it("fails when non erc-20 underlying", async () => {
      await expect(makeSLToken({ underlying: { _address: root } })).rejects.toRevert("revert");
    });

    it("fails when 0 initial exchange rate", async () => {
      await expect(makeSLToken({ exchangeRate: 0 })).rejects.toRevert("revert initial exchange rate must be greater than zero.");
    });

    it("succeeds with erc-20 underlying and non-zero exchange rate", async () => {
      const slToken = await makeSLToken();
      expect(await call(slToken, 'underlying')).toEqual(slToken.underlying._address);
      expect(await call(slToken, 'admin')).toEqual(root);
    });

    it("succeeds when setting admin to contructor argument", async () => {
      const slToken = await makeSLToken({ admin: admin });
      expect(await call(slToken, 'admin')).toEqual(admin);
    });
  });

  describe('name, symbol, decimals', () => {
    let slToken;

    beforeEach(async () => {
      slToken = await makeSLToken({ name: "SLToken Foo", symbol: "slFOO", decimals: 10 });
    });

    it('should return correct name', async () => {
      expect(await call(slToken, 'name')).toEqual("SLToken Foo");
    });

    it('should return correct symbol', async () => {
      expect(await call(slToken, 'symbol')).toEqual("slFOO");
    });

    it('should return correct decimals', async () => {
      expect(await call(slToken, 'decimals')).toEqualNumber(10);
    });
  });

  describe('balanceOfUnderlying', () => {
    it("has an underlying balance", async () => {
      const slToken = await makeSLToken({ supportMarket: true, exchangeRate: 2 });
      await send(slToken, 'harnessSetBalance', [root, 100]);
      expect(await call(slToken, 'balanceOfUnderlying', [root])).toEqualNumber(200);
    });
  });

  describe('borrowRatePerBlock', () => {
    it("has a borrow rate", async () => {
      const slToken = await makeSLToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const perBlock = await call(slToken, 'borrowRatePerBlock');
      expect(Math.abs(perBlock * 2102400 - 5e16)).toBeLessThanOrEqual(1e8);
    });
  });

  describe('supplyRatePerBlock', () => {
    it("returns 0 if there's no supply", async () => {
      const slToken = await makeSLToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate: .05, multiplier: 0.45, kink: 0.95, jump: 5 } });
      const perBlock = await call(slToken, 'supplyRatePerBlock');
      await expect(perBlock).toEqualNumber(0);
    });

    it("has a supply rate", async () => {
      const baseRate = 0.05;
      const multiplier = 0.45;
      const kink = 0.95;
      const jump = 5 * multiplier;
      const slToken = await makeSLToken({ supportMarket: true, interestRateModelOpts: { kind: 'jump-rate', baseRate, multiplier, kink, jump } });
      await send(slToken, 'harnessSetReserveFactorFresh', [etherMantissa(.01)]);
      await send(slToken, 'harnessExchangeRateDetails', [1, 1, 0]);
      await send(slToken, 'harnessSetExchangeRate', [etherMantissa(1)]);
      // Full utilization (Over the kink so jump is included), 1% reserves
      const borrowRate = baseRate + multiplier * kink + jump * .05;
      const expectedSuplyRate = borrowRate * .99;

      const perBlock = await call(slToken, 'supplyRatePerBlock');
      expect(Math.abs(perBlock * 2102400 - expectedSuplyRate * 1e18)).toBeLessThanOrEqual(1e8);
    });
  });

  describe("borrowBalanceCurrent", () => {
    let borrower;
    let slToken;

    beforeEach(async () => {
      borrower = accounts[0];
      slToken = await makeSLToken();
    });

    beforeEach(async () => {
      await setBorrowRate(slToken, .001)
      await send(slToken.interestRateModel, 'setFailBorrowRate', [false]);
    });

    it("reverts if interest accrual fails", async () => {
      await send(slToken.interestRateModel, 'setFailBorrowRate', [true]);
      // make sure we accrue interest
      await send(slToken, 'harnessFastForward', [1]);
      await expect(send(slToken, 'borrowBalanceCurrent', [borrower])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns successful result from borrowBalanceStored with no interest", async () => {
      await setBorrowRate(slToken, 0);
      await pretendBorrow(slToken, borrower, 1, 1, 5e18);
      expect(await call(slToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18)
    });

    it("returns successful result from borrowBalanceCurrent with no interest", async () => {
      await setBorrowRate(slToken, 0);
      await pretendBorrow(slToken, borrower, 1, 3, 5e18);
      expect(await send(slToken, 'harnessFastForward', [5])).toSucceed();
      expect(await call(slToken, 'borrowBalanceCurrent', [borrower])).toEqualNumber(5e18 * 3)
    });
  });

  describe("borrowBalanceStored", () => {
    let borrower;
    let slToken;

    beforeEach(async () => {
      borrower = accounts[0];
      slToken = await makeSLToken({ comptrollerOpts: { kind: 'bool' } });
    });

    it("returns 0 for account with no borrows", async () => {
      expect(await call(slToken, 'borrowBalanceStored', [borrower])).toEqualNumber(0)
    });

    it("returns stored principal when account and market indexes are the same", async () => {
      await pretendBorrow(slToken, borrower, 1, 1, 5e18);
      expect(await call(slToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18);
    });

    it("returns calculated balance when market index is higher than account index", async () => {
      await pretendBorrow(slToken, borrower, 1, 3, 5e18);
      expect(await call(slToken, 'borrowBalanceStored', [borrower])).toEqualNumber(5e18 * 3);
    });

    it("has undefined behavior when market index is lower than account index", async () => {
      // The market index < account index should NEVER happen, so we don't test this case
    });

    it("reverts on overflow of principal", async () => {
      await pretendBorrow(slToken, borrower, 1, 3, -1);
      await expect(call(slToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });

    it("reverts on non-zero stored principal with zero account index", async () => {
      await pretendBorrow(slToken, borrower, 0, 3, 5);
      await expect(call(slToken, 'borrowBalanceStored', [borrower])).rejects.toRevert("revert borrowBalanceStored: borrowBalanceStoredInternal failed");
    });
  });

  describe('exchangeRateStored', () => {
    let slToken, exchangeRate = 2;

    beforeEach(async () => {
      slToken = await makeSLToken({ exchangeRate });
    });

    it("returns initial exchange rate with zero cTokenSupply", async () => {
      const result = await call(slToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(exchangeRate));
    });

    it("calculates with single cTokenSupply and single total borrow", async () => {
      const cTokenSupply = 1, totalBorrows = 1, totalReserves = 0;
      await send(slToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves]);
      const result = await call(slToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1));
    });

    it("calculates with cTokenSupply and total borrows", async () => {
      const cTokenSupply = 100e18, totalBorrows = 10e18, totalReserves = 0;
      await send(slToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(slToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(.1));
    });

    it("calculates with cash and cTokenSupply", async () => {
      const cTokenSupply = 5e18, totalBorrows = 0, totalReserves = 0;
      expect(
        await send(slToken.underlying, 'transfer', [slToken._address, etherMantissa(500)])
      ).toSucceed();
      await send(slToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(slToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(100));
    });

    it("calculates with cash, borrows, reserves and cTokenSupply", async () => {
      const cTokenSupply = 500e18, totalBorrows = 500e18, totalReserves = 5e18;
      expect(
        await send(slToken.underlying, 'transfer', [slToken._address, etherMantissa(500)])
      ).toSucceed();
      await send(slToken, 'harnessExchangeRateDetails', [cTokenSupply, totalBorrows, totalReserves].map(etherUnsigned));
      const result = await call(slToken, 'exchangeRateStored');
      expect(result).toEqualNumber(etherMantissa(1.99));
    });
  });

  describe('getCash', () => {
    it("gets the cash", async () => {
      const slToken = await makeSLToken();
      const result = await call(slToken, 'getCash');
      expect(result).toEqualNumber(0);
    });
  });
});
