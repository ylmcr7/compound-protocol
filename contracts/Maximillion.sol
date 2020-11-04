pragma solidity ^0.5.16;

import "./SLEther.sol";

/**
 * @title Compound's Maximillion Contract
 * @author Compound
 */
contract Maximillion {
    /**
     * @notice The default slEther market to repay in
     */
    SLEther public slEther;

    /**
     * @notice Construct a Maximillion to repay max in a SLEther market
     */
    constructor(SLEther slEther_) public {
        slEther = slEther_;
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in the slEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, slEther);
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in a slEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param slEther_ The address of the slEther contract to repay in
     */
    function repayBehalfExplicit(address borrower, SLEther slEther_) public payable {
        uint received = msg.value;
        uint borrows = slEther_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            slEther_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            slEther_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
