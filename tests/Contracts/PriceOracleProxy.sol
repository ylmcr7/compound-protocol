pragma solidity ^0.5.16;

import "../../contracts/SLErc20.sol";
import "../../contracts/SLToken.sol";
import "../../contracts/PriceOracle.sol";

interface V1PriceOracleInterface {
    function assetPrices(address asset) external view returns (uint);
}

contract PriceOracleProxy is PriceOracle {
    /// @notice Indicator that this is a PriceOracle contract (for inspection)
    bool public constant isPriceOracle = true;

    /// @notice The v1 price oracle, which will continue to serve prices for v1 assets
    V1PriceOracleInterface public v1PriceOracle;

    /// @notice Address of the guardian, which may set the SAI price once
    address public guardian;

    /// @notice Address of the slEther contract, which has a constant price
    address public slEthAddress;

    /// @notice Address of the slUSDC contract, which we hand pick a key for
    address public slUsdcAddress;

    /// @notice Address of the slUSDT contract, which uses the slUSDC price
    address public slUsdtAddress;

    /// @notice Address of the slSAI contract, which may have its price set
    address public slSaiAddress;

    /// @notice Address of the slDAI contract, which we hand pick a key for
    address public slDaiAddress;

    /// @notice Handpicked key for USDC
    address public constant usdcOracleKey = address(1);

    /// @notice Handpicked key for DAI
    address public constant daiOracleKey = address(2);

    /// @notice Frozen SAI price (or 0 if not set yet)
    uint public saiPrice;

    /**
     * @param guardian_ The address of the guardian, which may set the SAI price once
     * @param v1PriceOracle_ The address of the v1 price oracle, which will continue to operate and hold prices for collateral assets
     * @param slEthAddress_ The address of slETH, which will return a constant 1e18, since all prices relative to ether
     * @param slUsdcAddress_ The address of cUSDC, which will be read from a special oracle key
     * @param slSaiAddress_ The address of cSAI, which may be read directly from storage
     * @param slDaiAddress_ The address of cDAI, which will be read from a special oracle key
     * @param slUsdtAddress_ The address of cUSDT, which uses the cUSDC price
     */
    constructor(address guardian_,
                address v1PriceOracle_,
                address slEthAddress_,
                address slUsdcAddress_,
                address slSaiAddress_,
                address slDaiAddress_,
                address slUsdtAddress_) public {
        guardian = guardian_;
        v1PriceOracle = V1PriceOracleInterface(v1PriceOracle_);

        slEthAddress = slEthAddress_;
        slUsdcAddress = slUsdcAddress_;
        slSaiAddress = slSaiAddress_;
        slDaiAddress = slDaiAddress_;
        slUsdtAddress = slUsdtAddress_;
    }

    /**
     * @notice Get the underlying price of a listed slToken asset
     * @param slToken The slToken to get the underlying price of
     * @return The underlying asset price mantissa (scaled by 1e18)
     */
    function getUnderlyingPrice(SLToken slToken) public view returns (uint) {
        address slTokenAddress = address(slToken);

        if (slTokenAddress == slEthAddress) {
            // ether always worth 1
            return 1e18;
        }

        if (slTokenAddress == slUsdcAddress || slTokenAddress == slUsdtAddress) {
            return v1PriceOracle.assetPrices(usdcOracleKey);
        }

        if (slTokenAddress == slDaiAddress) {
            return v1PriceOracle.assetPrices(daiOracleKey);
        }

        if (slTokenAddress == slSaiAddress) {
            // use the frozen SAI price if set, otherwise use the DAI price
            return saiPrice > 0 ? saiPrice : v1PriceOracle.assetPrices(daiOracleKey);
        }

        // otherwise just read from v1 oracle
        address underlying = SLErc20(slTokenAddress).underlying();
        return v1PriceOracle.assetPrices(underlying);
    }

    /**
     * @notice Set the price of SAI, permanently
     * @param price The price for SAI
     */
    function setSaiPrice(uint price) public {
        require(msg.sender == guardian, "only guardian may set the SAI price");
        require(saiPrice == 0, "SAI price may only be set once");
        require(price < 0.1e18, "SAI price must be < 0.1 ETH");
        saiPrice = price;
    }
}
