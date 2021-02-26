const SashimiLendingLens = artifacts.require("SashimiLendingLens");
const fs = require('fs');
const directory = './deploy/data';
module.exports = function (deployer) {
    deployer.deploy(SashimiLendingLens, { gas: 6000000 }).then(function () {
        fs.appendFileSync(directory + `/contractAddress.txt`, '\n' + SashimiLendingLens.address, 'utf8');
        console.log("SashimiLendingLens address is saved in", `contractAddress.txt`);
    });
}