const WhitePaperInterestRateModel = artifacts.require("WhitePaperInterestRateModel");
const JumpRateModelV2 = artifacts.require("JumpRateModelV2");
const fs = require('fs');
const directory = './deploy/data';

var baseRatePerYear = 0;
var multiplierPerYear = "610351562500";
module.exports = function (deployer) {
    deployer.deploy(WhitePaperInterestRateModel, baseRatePerYear, multiplierPerYear, { gas: 6000000 }).then(function () {
        fs.appendFileSync(directory + `/contractAddress.txt`, '\nWhitePaperInterestRateModel:' + WhitePaperInterestRateModel.address, 'utf8');
        console.log("WhitePaperInterestRateModel address is saved in", `contractAddress.txt`);
    });

    baseRatePerYear = 0;
    multiplierPerYear = "610351562500";
    jumpMultiplierPerYear = "16632080078125";
    kink_ = "762939453125";
    owner_ = "0x2E7c4EfdFA6680e34988dcBD70F6a31b4CC28219";

    deployer.deploy(JumpRateModelV2, baseRatePerYear, multiplierPerYear, jumpMultiplierPerYear, kink_, owner_, { gas: 6000000 }).then(function () {
        fs.appendFileSync(directory + `/contractAddress.txt`, '\nJumpRateModelV2:' + JumpRateModelV2.address, 'utf8');
        console.log("JumpRateModelV2 address is saved in", `contractAddress.txt`);
    });
};