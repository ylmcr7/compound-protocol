const SLErc20Delegator = artifacts.require("SLErc20Delegator");
const SLErc20Delegate = artifacts.require("SLErc20Delegate");
const Unitroller = artifacts.require("Unitroller");
const WhitePaperInterestRateModel = artifacts.require("WhitePaperInterestRateModel");
const fs = require('fs');
const directory = './deploy/data';

let USDTAddress = "0x3F280eE5876CE8B15081947E0f189E336bb740A5";
let INITIALEXCHANGERATEMANTISSA_ = "201651901844513861760148860";
name = "slUSDT";
symbol = "slUSDT";
let DECIMALS_ =
    8;
let ADMIN_ =
    "0x2E7c4EfdFA6680e34988dcBD70F6a31b4CC28219";

module.exports = function (deployer) {

    deployer.deploy(SLErc20Delegator, USDTAddress, Unitroller.address, WhitePaperInterestRateModel.address, INITIALEXCHANGERATEMANTISSA_, name, symbol, DECIMALS_, ADMIN_, SLErc20Delegate.address, SLErc20Delegate.address, { gas: 6000000 }).then(function () {
        fs.appendFileSync(directory + `/contractAddress.txt`, '\nslUSDT SLErc20Delegate:' + SLErc20Delegate.address + '\nSLErc20Delegator:' + SLErc20Delegator.address, 'utf8');
        console.log("SLErc20Delegator address is saved in", `contractAddress.txt`);
    });

}