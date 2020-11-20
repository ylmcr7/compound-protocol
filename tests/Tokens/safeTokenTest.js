const {
  makeSLToken,
  getBalances,
  adjustBalances
} = require('../Utils/SashimiLending');

const exchangeRate = 5;

describe('SLEther', function () {
  let root, nonRoot, accounts;
  let slToken;
  beforeEach(async () => {
    [root, nonRoot, ...accounts] = saddle.accounts;
    slToken = await makeSLToken({kind: 'slether', comptrollerOpts: {kind: 'bool'}});
  });

  describe("getCashPrior", () => {
    it("returns the amount of ether held by the slEther contract before the current message", async () => {
      expect(await call(slToken, 'harnessGetCashPrior', [], {value: 100})).toEqualNumber(0);
    });
  });

  describe("doTransferIn", () => {
    it("succeeds if from is msg.nonRoot and amount is msg.value", async () => {
      expect(await call(slToken, 'harnessDoTransferIn', [root, 100], {value: 100})).toEqualNumber(100);
    });

    it("reverts if from != msg.sender", async () => {
      await expect(call(slToken, 'harnessDoTransferIn', [nonRoot, 100], {value: 100})).rejects.toRevert("revert sender mismatch");
    });

    it("reverts if amount != msg.value", async () => {
      await expect(call(slToken, 'harnessDoTransferIn', [root, 77], {value: 100})).rejects.toRevert("revert value mismatch");
    });

    describe("doTransferOut", () => {
      it("transfers ether out", async () => {
        const beforeBalances = await getBalances([slToken], [nonRoot]);
        const receipt = await send(slToken, 'harnessDoTransferOut', [nonRoot, 77], {value: 77});
        const afterBalances = await getBalances([slToken], [nonRoot]);
        expect(receipt).toSucceed();
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [slToken, nonRoot, 'eth', 77]
        ]));
      });

      it("reverts if it fails", async () => {
        await expect(call(slToken, 'harnessDoTransferOut', [root, 77], {value: 0})).rejects.toRevert();
      });
    });
  });
});
