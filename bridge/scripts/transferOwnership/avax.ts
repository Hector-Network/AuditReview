import { BigNumber } from 'ethers';
import { waitSeconds } from '../helper';
const hre = require("hardhat");


async function main() {
    const proxyAdminAddress = ""
    const proxyAddress = ""
    const DAO = "0x078E3977b30955f4Af9AA1D9DeC4ceB660c36e0c";

	const [deployer] = await hre.ethers.getSigners();
    
	const hecBridgeSplitterFactory = await ethers.getContractFactory("HecBridgeSplitter");
	console.log("Deploying HecBridgeSplitter Contract...");

    const proxyAdmin = await hecBridgeSplitterFactory.attach(proxyAdminAddress)
	// Set Parameter
	console.log("Transfer Ownership of Proxy Admin...");
	await proxyAdmin.connect(deployer).transferOwnership(DAO);
	await waitSeconds(3);

    const proxy = await hecBridgeSplitterFactory.attach(proxyAddress)
	// Set Parameter
	console.log("Transfer Ownership of Proxy Admin...");
	await proxy.connect(deployer).transferOwnership(DAO);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
