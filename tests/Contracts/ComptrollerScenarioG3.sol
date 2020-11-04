pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG3.sol";

contract ComptrollerScenarioG3 is ComptrollerG3 {
    uint public blockNumber;
    address public sashimiAddress;

    constructor() ComptrollerG3() public {}

    function setSashimiAddress(address sashimiAddress_) public {
        sashimiAddress = sashimiAddress_;
    }

    function getSashimiAddress() public view returns (address) {
        return sashimiAddress;
    }

    function membershipLength(SLToken slToken) public view returns (uint) {
        return accountAssets[address(slToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;

        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getSashimiMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isSashimied) {
                n++;
            }
        }

        address[] memory sashimiMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isSashimied) {
                sashimiMarkets[k++] = address(allMarkets[i]);
            }
        }
        return sashimiMarkets;
    }

    function unlist(SLToken slToken) public {
        markets[address(slToken)].isListed = false;
    }
}
