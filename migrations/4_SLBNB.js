const SLEther = artifacts.require("SLEther");
const Unitroller = artifacts.require("Unitroller");
const WhitePaperInterestRateModel = artifacts.require("WhitePaperInterestRateModel");
const fs = require('fs');
const directory = './deploy/data';


let INITIALEXCHANGERATEMANTISSA_ = "201651901844513861760148860";
let NAME_ = "slBNB";
let SYMBOL_ =
    "slBNB";
let DECIMALS_ =
    8;
let ADMIN_ =
    "0x2E7c4EfdFA6680e34988dcBD70F6a31b4CC28219";

module.exports = function (deployer) {
    deployer.deploy(SLEther, Unitroller.address, WhitePaperInterestRateModel.address, INITIALEXCHANGERATEMANTISSA_, NAME_, SYMBOL_, DECIMALS_, ADMIN_, { gas: 6000000 }).then(function () {
        fs.appendFileSync(directory + `/contractAddress.txt`, '\nslBNB:' + SLEther.address, 'utf8');
        console.log("SLBNB address is saved in", `contractAddress.txt`);
    });
};
