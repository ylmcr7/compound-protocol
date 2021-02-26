const Maximillion = artifacts.require("Maximillion");
const SLEther = artifacts.require("SLEther");
const fs = require('fs');
const directory = './deploy/data';
slBNB = SLEther.address;
module.exports = function (deployer) {
    deployer.deploy(Maximillion, slBNB, { gas: 6000000 }).then(function () {
        fs.appendFileSync(directory + `/contractAddress.txt`, '\nMaximillion:' + Maximillion.address, 'utf8');
        console.log("Maximillion address is saved in", `contractAddress.txt`);
    });
}