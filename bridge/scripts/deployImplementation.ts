import { BigNumber } from 'ethers';
import { waitSeconds } from '../helper';

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const HecBridgeSplitterFatory = await ethers.getContractFactory("HecBridgeSplitter")
    console.log("Deploying HecBridgeSplitter Implementation...");
    const hecBridgeSplitterContract =  await HecBridgeSplitterFatory.deploy()

    console.log("New Implementation contract deployed to:", hecBridgeSplitterContract.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  