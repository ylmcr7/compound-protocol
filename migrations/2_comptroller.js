const Comptroller = artifacts.require("Comptroller");
const Unitroller = artifacts.require("Unitroller");
const fs = require('fs');
const directory = './deploy/data';
module.exports = function (deployer) {
    deployer.deploy(Comptroller, { gas: 6000000 }).then(function () {
        fs.writeFileSync(directory + `/contractAddress.txt`, 'Comptroller:' + Comptroller.address, 'utf8');
        console.log("Comptroller address is saved in", `contractAddress.txt`);
    })

    deployer.deploy(Unitroller, { gas: 6000000 }).then(function () {

        fs.appendFileSync(directory + `/contractAddress.txt`, '\nUnitroller:' + Unitroller.address, 'utf8');

        console.log("Unitroller address is saved in", `contractAddress.txt`);
    })
}
