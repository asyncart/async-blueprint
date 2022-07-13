const { ethers, upgrades, network } = require("hardhat");

//Enables shell commands
let options = {shell: true};

//var proxy = require('./contracts/deploy/01_DeployContractsWithProx.js');

//proxy.run;


//Run hardhat console code to compile and deploy

const { spawn } = require("child_process");
const { exec } = require("child_process");


// const depCon = spawn("npx", ["hardhat", "run", "./contracts/deploy/01_DeployContractsWithProx.js", "--network mumbai"], options)
//     .on('error', function( err ){ throw err })
// ;

// const depCon = spawn("yarn", ["deploy", "mumbai"], options)
//     .on('error', function( err ){ throw err })
// ;
// const depCon = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['--v'],options);


//Deply ### Set name ticker and deployer address.
const depCon = spawn("yarn", ["deploy-mumbai-prox"], options)
    .on('error', function( err ){ throw err })
;

// Verify contract ## Get contract name from deploy .js....
// let instanceAddress ="0x333B4d1AC5d6c805E59E09E57E6E1Be53B4D208F"
// const verifyCon = spawn("yarn", ["verify",instanceAddress ], options)
//     .on('error', function( err ){ throw err })
// ;


try {
    depCon.stdout.on("data", data => {
        console.log(`stdout: ${data}`);
    });

    depCon.stderr.on("data", data => {
        console.log(`stderr: ${data}`);
    });

    depCon.on('error', (error) => {
        console.log(`error: ${error.message}`);
    });

    depCon.on("close", code => {
        console.log(`child process exited with code ${code}`);
    });

} catch (e) {}


try {
    verifyCon.stdout.on("data", data => {
        console.log(`stdout: ${data}`);
    });

    verifyCon.stderr.on("data", data => {
        console.log(`stderr: ${data}`);
    });

    verifyCon.on('error', (error) => {
        console.log(`error: ${error.message}`);
    });

    verifyCon.on("close", code => {
        console.log(`child process exited with code ${code}`);
    });
} catch (e) {}
