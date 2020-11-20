const {
  address,
  encodeParameters,
} = require('../Utils/Ethereum');
const {
  makeComptroller,
  makeSLToken,
} = require('../Utils/SashimiLending');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('SashimiLendingLens', () => {
  let sashimiLendingLens;
  let acct;

  beforeEach(async () => {
    sashimiLendingLens = await deploy('SashimiLendingLens');
    acct = accounts[0];
  });

  describe('slTokenMetadata', () => {
    it('is correct for a slErc20', async () => {
      let slErc20 = await makeSLToken();
      expect(
        cullTuple(await call(sashimiLendingLens, 'slTokenMetadata', [slErc20._address]))
      ).toEqual(
        {
          slToken: slErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(slErc20, 'underlying', []),
          slTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for slEth', async () => {
      let slEth = await makeSLToken({kind: 'slether'});
      expect(
        cullTuple(await call(sashimiLendingLens, 'slTokenMetadata', [slEth._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        slToken: slEth._address,
        slTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('slTokenMetadataAll', () => {
    it('is correct for a slErc20 and slEther', async () => {
      let slErc20 = await makeSLToken();
      let slEth = await makeSLToken({kind: 'slether'});
      expect(
        (await call(sashimiLendingLens, 'slTokenMetadataAll', [[slErc20._address, slEth._address]])).map(cullTuple)
      ).toEqual([
        {
          slToken: slErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(slErc20, 'underlying', []),
          slTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          slToken: slEth._address,
          slTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('slTokenBalances', () => {
    it('is correct for slERC20', async () => {
      let slErc20 = await makeSLToken();
      expect(
        cullTuple(await call(sashimiLendingLens, 'slTokenBalances', [slErc20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          slToken: slErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for slETH', async () => {
      let slEth = await makeSLToken({kind: 'slether'});
      let ethBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(sashimiLendingLens, 'slTokenBalances', [slEth._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          slToken: slEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      );
    });
  });

  describe('slTokenBalancesAll', () => {
    it('is correct for slEth and slErc20', async () => {
      let slErc20 = await makeSLToken();
      let slEth = await makeSLToken({kind: 'slether'});
      let ethBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(sashimiLendingLens, 'slTokenBalancesAll', [[slErc20._address, slEth._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          slToken: slErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          slToken: slEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      ]);
    })
  });

  describe('slTokenUnderlyingPrice', () => {
    it('gets correct price for slErc20', async () => {
      let slErc20 = await makeSLToken();
      expect(
        cullTuple(await call(sashimiLendingLens, 'slTokenUnderlyingPrice', [slErc20._address]))
      ).toEqual(
        {
          slToken: slErc20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for slEth', async () => {
      let slEth = await makeSLToken({kind: 'slether'});
      expect(
        cullTuple(await call(sashimiLendingLens, 'slTokenUnderlyingPrice', [slEth._address]))
      ).toEqual(
        {
          slToken: slEth._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('slTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let slErc20 = await makeSLToken();
      let slEth = await makeSLToken({kind: 'slether'});
      expect(
        (await call(sashimiLendingLens, 'slTokenUnderlyingPriceAll', [[slErc20._address, slEth._address]])).map(cullTuple)
      ).toEqual([
        {
          slToken: slErc20._address,
          underlyingPrice: "0",
        },
        {
          slToken: slEth._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(sashimiLendingLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  

  describe('sashimi', () => {
    let sashimi, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      sashimi = await deploy('SashimiToken', [acct]);
    });

    describe('getCompBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(sashimiLendingLens, 'getSashimiBalanceMetadata', [sashimi._address, acct]))
        ).toEqual({
          balance: "10000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getSashimiBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setSashimiAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(sashimiLendingLens, 'getSashimiBalanceMetadataExt', [sashimi._address, comptroller._address, acct]))
        ).toEqual({
          balance: "10000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });
  });
});
