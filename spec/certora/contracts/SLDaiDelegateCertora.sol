pragma solidity ^0.5.16;

import "../../../contracts/SLDaiDelegate.sol";

contract SLDaiDelegateCertora is SLDaiDelegate {
    function getCashOf(address account) public view returns (uint) {
        return EIP20Interface(underlying).balanceOf(account);
    }
}
