const fs = require('fs');
module.exports = async function (callback) {
    fs.readFile('./deploy/slToken.json', (err, data) => {
        if (err) throw err;
        let slTokens = JSON.parse(data);

        console.log("sltoken paras")
        console.log("----------\n")

        for (const [name, paras] of Object.entries(slTokens)) {
            underlying_ = paras.underlying_;
            console.log(name, "-", underlying_);
        }
    });

}