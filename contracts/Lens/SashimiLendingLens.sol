pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../SLErc20.sol";
import "../SLToken.sol";
import "../PriceOracle.sol";
import "../EIP20Interface.sol";

interface ComptrollerLensInterface {
    function markets(address) external view returns (bool, uint);
    function oracle() external view returns (PriceOracle);
    function getAccountLiquidity(address) external view returns (uint, uint, uint);
    function getAssetsIn(address) external view returns (SLToken[] memory);
    function claimSashimi(address) external;
    function sashimiAccrued(address) external view returns (uint);
}

contract SashimiLendingLens {
    struct SLTokenMetadata {
        address slToken;
        uint exchangeRateCurrent;
        uint supplyRatePerBlock;
        uint borrowRatePerBlock;
        uint reserveFactorMantissa;
        uint totalBorrows;
        uint totalReserves;
        uint totalSupply;
        uint totalCash;
        bool isListed;
        uint collateralFactorMantissa;
        address underlyingAssetAddress;
        uint slTokenDecimals;
        uint underlyingDecimals;
    }

    function slTokenMetadata(SLToken slToken) public returns (SLTokenMetadata memory) {
        uint exchangeRateCurrent = slToken.exchangeRateCurrent();
        ComptrollerLensInterface comptroller = ComptrollerLensInterface(address(slToken.comptroller()));
        (bool isListed, uint collateralFactorMantissa) = comptroller.markets(address(slToken));
        address underlyingAssetAddress;
        uint underlyingDecimals;

        if (compareStrings(slToken.symbol(), "slETH")) {
            underlyingAssetAddress = address(0);
            underlyingDecimals = 18;
        } else {
            SLErc20 slErc20 = SLErc20(address(slToken));
            underlyingAssetAddress = slErc20.underlying();
            underlyingDecimals = EIP20Interface(slErc20.underlying()).decimals();
        }

        return SLTokenMetadata({
            slToken: address(slToken),
            exchangeRateCurrent: exchangeRateCurrent,
            supplyRatePerBlock: slToken.supplyRatePerBlock(),
            borrowRatePerBlock: slToken.borrowRatePerBlock(),
            reserveFactorMantissa: slToken.reserveFactorMantissa(),
            totalBorrows: slToken.totalBorrows(),
            totalReserves: slToken.totalReserves(),
            totalSupply: slToken.totalSupply(),
            totalCash: slToken.getCash(),
            isListed: isListed,
            collateralFactorMantissa: collateralFactorMantissa,
            underlyingAssetAddress: underlyingAssetAddress,
            slTokenDecimals: slToken.decimals(),
            underlyingDecimals: underlyingDecimals
        });
    }

    function slTokenMetadataAll(SLToken[] calldata slTokens) external returns (SLTokenMetadata[] memory) {
        uint slTokenCount = slTokens.length;
        SLTokenMetadata[] memory res = new SLTokenMetadata[](slTokenCount);
        for (uint i = 0; i < slTokenCount; i++) {
            res[i] = slTokenMetadata(slTokens[i]);
        }
        return res;
    }

    struct SLTokenBalances {
        address slToken;
        uint balanceOf;
        uint borrowBalanceCurrent;
        uint balanceOfUnderlying;
        uint tokenBalance;
        uint tokenAllowance;
    }

    function slTokenBalances(SLToken slToken, address payable account) public returns (SLTokenBalances memory) {
        uint balanceOf = slToken.balanceOf(account);
        uint borrowBalanceCurrent = slToken.borrowBalanceCurrent(account);
        uint balanceOfUnderlying = slToken.balanceOfUnderlying(account);
        uint tokenBalance;
        uint tokenAllowance;

        if (compareStrings(slToken.symbol(), "slETH")) {
            tokenBalance = account.balance;
            tokenAllowance = account.balance;
        } else {
            SLErc20 slErc20 = SLErc20(address(slToken));
            EIP20Interface underlying = EIP20Interface(slErc20.underlying());
            tokenBalance = underlying.balanceOf(account);
            tokenAllowance = underlying.allowance(account, address(slToken));
        }

        return SLTokenBalances({
            slToken: address(slToken),
            balanceOf: balanceOf,
            borrowBalanceCurrent: borrowBalanceCurrent,
            balanceOfUnderlying: balanceOfUnderlying,
            tokenBalance: tokenBalance,
            tokenAllowance: tokenAllowance
        });
    }

    function slTokenBalancesAll(SLToken[] calldata slTokens, address payable account) external returns (SLTokenBalances[] memory) {
        uint slTokenCount = slTokens.length;
        SLTokenBalances[] memory res = new SLTokenBalances[](slTokenCount);
        for (uint i = 0; i < slTokenCount; i++) {
            res[i] = slTokenBalances(slTokens[i], account);
        }
        return res;
    }

    struct SLTokenUnderlyingPrice {
        address slToken;
        uint underlyingPrice;
    }

    function slTokenUnderlyingPrice(SLToken slToken) public returns (SLTokenUnderlyingPrice memory) {
        ComptrollerLensInterface comptroller = ComptrollerLensInterface(address(slToken.comptroller()));
        PriceOracle priceOracle = comptroller.oracle();

        return SLTokenUnderlyingPrice({
            slToken: address(slToken),
            underlyingPrice: priceOracle.getUnderlyingPrice(slToken)
        });
    }

    function slTokenUnderlyingPriceAll(SLToken[] calldata slTokens) external returns (SLTokenUnderlyingPrice[] memory) {
        uint slTokenCount = slTokens.length;
        SLTokenUnderlyingPrice[] memory res = new SLTokenUnderlyingPrice[](slTokenCount);
        for (uint i = 0; i < slTokenCount; i++) {
            res[i] = slTokenUnderlyingPrice(slTokens[i]);
        }
        return res;
    }

    struct AccountLimits {
        SLToken[] markets;
        uint liquidity;
        uint shortfall;
    }

    function getAccountLimits(ComptrollerLensInterface comptroller, address account) public returns (AccountLimits memory) {
        (uint errorCode, uint liquidity, uint shortfall) = comptroller.getAccountLiquidity(account);
        require(errorCode == 0);

        return AccountLimits({
            markets: comptroller.getAssetsIn(account),
            liquidity: liquidity,
            shortfall: shortfall
        });
    }

    struct SashimiBalanceMetadata {
        uint balance;
        uint votes;
        address delegate;
    }

    function getSashimiBalanceMetadata(EIP20Interface sashimi, address account) external view returns (SashimiBalanceMetadata memory) {
        return SashimiBalanceMetadata({
            balance: sashimi.balanceOf(account),
            votes : 0,
            delegate :address(0)
        });
    }

    struct SashimiBalanceMetadataExt {
        uint balance;
        uint votes;
        address delegate;
        uint allocated;
    }

    function getSashimiBalanceMetadataExt(EIP20Interface sashimi, ComptrollerLensInterface comptroller, address account) external returns (SashimiBalanceMetadataExt memory) {
        uint balance = sashimi.balanceOf(account);
        comptroller.claimSashimi(account);
        uint newBalance = sashimi.balanceOf(account);
        uint accrued = comptroller.sashimiAccrued(account);
        uint total = add(accrued, newBalance, "sum sashimi total");
        uint allocated = sub(total, balance, "sub allocated");

        return SashimiBalanceMetadataExt({
            balance: balance,
            votes: 0,
            delegate: address(0),
            allocated: allocated
        });
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    function add(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        uint c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub(uint a, uint b, string memory errorMessage) internal pure returns (uint) {
        require(b <= a, errorMessage);
        uint c = a - b;
        return c;
    }
}
