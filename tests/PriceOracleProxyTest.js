const BigNumber = require('bignumber.js');

const {
  address,
  etherMantissa
} = require('./Utils/Ethereum');

const {
  makeSLToken,
  makePriceOracle,
} = require('./Utils/SashimiLending');

describe('PriceOracleProxy', () => {
  let root, accounts;
  let oracle, backingOracle, slEth, slUsdc, slSai, slDai, slUsdt, cOther;
  let daiOracleKey = address(2);

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    slEth = await makeSLToken({kind: "slether", comptrollerOpts: {kind: "v1-no-proxy"}, supportMarket: true});
    slUsdc = await makeSLToken({comptroller: slEth.comptroller, supportMarket: true});
    slSai = await makeSLToken({comptroller: slEth.comptroller, supportMarket: true});
    slDai = await makeSLToken({comptroller: slEth.comptroller, supportMarket: true});
    slUsdt = await makeSLToken({comptroller: slEth.comptroller, supportMarket: true});
    cOther = await makeSLToken({comptroller: slEth.comptroller, supportMarket: true});

    backingOracle = await makePriceOracle();
    oracle = await deploy('PriceOracleProxy',
      [
        root,
        backingOracle._address,
        slEth._address,
        slUsdc._address,
        slSai._address,
        slDai._address,
        slUsdt._address
      ]
     );
  });

  describe("constructor", () => {
    it("sets address of guardian", async () => {
      let configuredGuardian = await call(oracle, "guardian");
      expect(configuredGuardian).toEqual(root);
    });

    it("sets address of v1 oracle", async () => {
      let configuredOracle = await call(oracle, "v1PriceOracle");
      expect(configuredOracle).toEqual(backingOracle._address);
    });

    it("sets address of slEth", async () => {
      let configuredSLEther = await call(oracle, "slEthAddress");
      expect(configuredSLEther).toEqual(slEth._address);
    });

    it("sets address of slUSDC", async () => {
      let configuredSLUSD = await call(oracle, "slUsdcAddress");
      expect(configuredSLUSD).toEqual(slUsdc._address);
    });

    it("sets address of slSAI", async () => {
      let configuredSLSAI = await call(oracle, "slSaiAddress");
      expect(configuredSLSAI).toEqual(slSai._address);
    });

    it("sets address of slDAI", async () => {
      let configuredSLDAI = await call(oracle, "slDaiAddress");
      expect(configuredSLDAI).toEqual(slDai._address);
    });

    it("sets address of slUSDT", async () => {
      let configuredSLUSDT = await call(oracle, "slUsdtAddress");
      expect(configuredSLUSDT).toEqual(slUsdt._address);
    });
  });

  describe("getUnderlyingPrice", () => {
    let setAndVerifyBackingPrice = async (slToken, price) => {
      await send(
        backingOracle,
        "setUnderlyingPrice",
        [slToken._address, etherMantissa(price)]);

      let backingOraclePrice = await call(
        backingOracle,
        "assetPrices",
        [slToken.underlying._address]);

      expect(Number(backingOraclePrice)).toEqual(price * 1e18);
    };

    let readAndVerifyProxyPrice = async (token, price) =>{
      let proxyPrice = await call(oracle, "getUnderlyingPrice", [token._address]);
      expect(Number(proxyPrice)).toEqual(price * 1e18);;
    };

    it("always returns 1e18 for slEth", async () => {
      await readAndVerifyProxyPrice(slEth, 1);
    });

    it("uses address(1) for USDC and address(2) for cdai", async () => {
      await send(backingOracle, "setDirectPrice", [address(1), etherMantissa(5e12)]);
      await send(backingOracle, "setDirectPrice", [address(2), etherMantissa(8)]);
      await readAndVerifyProxyPrice(slDai, 8);
      await readAndVerifyProxyPrice(slUsdc, 5e12);
      await readAndVerifyProxyPrice(slUsdt, 5e12);
    });

    it("proxies for whitelisted tokens", async () => {
      await setAndVerifyBackingPrice(cOther, 11);
      await readAndVerifyProxyPrice(cOther, 11);

      await setAndVerifyBackingPrice(cOther, 37);
      await readAndVerifyProxyPrice(cOther, 37);
    });

    it("returns 0 for token without a price", async () => {
      let unlistedToken = await makeSLToken({comptroller: slEth.comptroller});

      await readAndVerifyProxyPrice(unlistedToken, 0);
    });

    it("correctly handle setting SAI price", async () => {
      await send(backingOracle, "setDirectPrice", [daiOracleKey, etherMantissa(0.01)]);

      await readAndVerifyProxyPrice(slDai, 0.01);
      await readAndVerifyProxyPrice(slSai, 0.01);

      await send(oracle, "setSaiPrice", [etherMantissa(0.05)]);

      await readAndVerifyProxyPrice(slDai, 0.01);
      await readAndVerifyProxyPrice(slSai, 0.05);

      await expect(send(oracle, "setSaiPrice", [1])).rejects.toRevert("revert SAI price may only be set once");
    });

    it("only guardian may set the sai price", async () => {
      await expect(send(oracle, "setSaiPrice", [1], {from: accounts[0]})).rejects.toRevert("revert only guardian may set the SAI price");
    });

    it("sai price must be bounded", async () => {
      await expect(send(oracle, "setSaiPrice", [etherMantissa(10)])).rejects.toRevert("revert SAI price must be < 0.1 ETH");
    });
});
});
