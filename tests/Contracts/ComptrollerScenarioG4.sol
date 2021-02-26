pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG4.sol";

contract ComptrollerScenarioG4 is ComptrollerG4 {
    uint public blockNumber;

    constructor() ComptrollerG4() public {}

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
