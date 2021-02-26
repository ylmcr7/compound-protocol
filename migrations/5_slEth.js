SLErc20Delegator = artifacts.require("SLErc20Delegator");
const SLErc20Delegate = artifacts.require("SLErc20Delegate");
const Unitroller = artifacts.require("Unitroller");
const WhitePaperInterestRateModel = artifacts.require("WhitePaperInterestRateModel");
const fs = require('fs');
const directory = './deploy/data';

let INITIALEXCHANGERATEMANTISSA_ = "201651901844513861760148860";
let DECIMALS_ =
    8;
let ADMIN_ =
    "0x2E7c4EfdFA6680e34988dcBD70F6a31b4CC28219";
name = "slETH";
symbol = "SLETH";
ETHAddress = "0x86b8AC6E084B8fF4E851716Ca8c3F8E5BAdb099e";
module.exports = function (deployer) {

    deployer.deploy(SLErc20Delegate, { gas: 6000000 }).then(function () {
        deployer.deploy(SLErc20Delegator, ETHAddress, Unitroller.address, WhitePaperInterestRateModel.address, INITIALEXCHANGERATEMANTISSA_, name, symbol, DECIMALS_, ADMIN_, SLErc20Delegate.address, SLErc20Delegate.address, { gas: 6000000 }).then(function () {
            fs.appendFileSync(directory + `/contractAddress.txt`, '\nSLETH SLErc20Delegate:' + SLErc20Delegate.address + '\n SLErc20Delegator:' + SLErc20Delegator.address, 'utf8');
            console.log("SLErc20Delegator address is saved in", `contractAddress.txt`);
        });
    });
}