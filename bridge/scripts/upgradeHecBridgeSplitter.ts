import { BigNumber } from 'ethers';
const { ethers, upgrades  } = require("hardhat");
require("dotenv").config();

// const UPGRADEABLE_PROXY = process.env.FTM_MAIN_SPLITTER_ADDRESS;
const UPGRADEABLE_PROXY = "0x9F9b48704B965bB889A988f2A638B5B526544380";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  const UpgradeContract = await ethers.getContractFactory("HecBridgeSplitter");
  console.log("Upgrading HecBridgeSplitter...");
  let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, UpgradeContract, {
    gasPrice: gas,
  });

  console.log("HecBridgeSplitter contract upgraded to:", upgrade.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
