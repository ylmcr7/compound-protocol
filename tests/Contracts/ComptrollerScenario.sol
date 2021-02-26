pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";

contract ComptrollerScenario is Comptroller {
    uint public blockNumber;

    constructor() Comptroller() public {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function membershipLength(SLToken slToken) public view returns (uint) {
        return accountAssets[address(slToken)].length;
    }

    function unlist(SLToken slToken) public {
        markets[address(slToken)].isListed = false;
    }
}
