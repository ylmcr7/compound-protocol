const {makeSLToken} = require('../Utils/SashimiLending');

describe('SLToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const slToken = await makeSLToken({supportMarket: true});
      expect(await call(slToken, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(slToken, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers 50 tokens", async () => {
      const slToken = await makeSLToken({supportMarket: true});
      await send(slToken, 'harnessSetBalance', [root, 100]);
      expect(await call(slToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(slToken, 'transfer', [accounts[0], 50]);
      expect(await call(slToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(slToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const slToken = await makeSLToken({supportMarket: true});
      await send(slToken, 'harnessSetBalance', [root, 100]);
      expect(await call(slToken, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(slToken, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const slToken = await makeSLToken({comptrollerOpts: {kind: 'bool'}});
      await send(slToken, 'harnessSetBalance', [root, 100]);
      expect(await call(slToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(slToken.comptroller, 'setTransferAllowed', [false])
      expect(await send(slToken, 'transfer', [root, 50])).toHaveTrollReject('TRANSFER_COMPTROLLER_REJECTION');

      await send(slToken.comptroller, 'setTransferAllowed', [true])
      await send(slToken.comptroller, 'setTransferVerify', [false])
      await expect(send(slToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });
  });
});