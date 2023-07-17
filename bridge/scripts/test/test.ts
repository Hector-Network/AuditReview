import { BigNumber } from '@ethersproject/bignumber';
const hre = require('hardhat');
const { ethers } = require('hardhat');
const abi = require('../../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json');
const erc20Abi = require('../../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const tempStepData = require('./dataForBridgeNativeLiFi.json');
require('dotenv').config();

async function main() {
    const HecBridgeSplitterFatory = await ethers.getContractFactory("HecBridgeSplitterTest")
    console.log("Deploying HecBridgeSplitter Implementation...");
    const hecBridgeSplitterContract =  await HecBridgeSplitterFatory.deploy()
    console.log("setting up")
    let tx1 = await hecBridgeSplitterContract.setUp()
    await tx1.wait()
    console.log("testing ... ")
    let tx2 = await hecBridgeSplitterContract.testBridge({value: "2000000000000000000"})
    await tx2.wait()

}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
