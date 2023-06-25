import { BigNumber } from 'ethers';
import { waitSeconds } from '../helper';
const hre = require("hardhat");

async function main() {
	const [deployer] = await hre.ethers.getSigners();
	const _countDest = 2; // Count of the destination wallets, default: 2
	const lifiBridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
	const squidRouter = "0xce16f69375520ab01377ce7b88f5ba8c48f8d666";

	const feePercentage = 75;
	const DAO = "0x3CDF52CC28D21C5b7b91d7065fd6dfE6d426FCC5";
	const version = "2.0";

	console.log("Deploying contracts with the account:", deployer.address);
	console.log("Account balance:", (await deployer.getBalance()).toString());

	const gas = await ethers.provider.getGasPrice();
	console.log("Gas Price: ", gas);

	const hecBridgeSplitterFactory = await ethers.getContractFactory("HecBridgeSplitter");
	console.log("Deploying HecBridgeSplitter Contract...");

	const hecBridgeSplitterContract = await hre.upgrades.deployProxy(
		hecBridgeSplitterFactory,
		[_countDest, 0],
		{
			gas: gas,
			initializer: "initialize",
		}
	);
	
	console.log("HecBridgeSplitter contract deployed to:", hecBridgeSplitterContract.address);

	// Set Parameter
	console.log("Setting parameters...");
	await hecBridgeSplitterContract.connect(deployer).setMinFeePercentage(feePercentage);
	await waitSeconds(3);
	await hecBridgeSplitterContract.connect(deployer).setDAO(DAO);
	await waitSeconds(3);
	await hecBridgeSplitterContract.connect(deployer).setVersion(version);
	await waitSeconds(3);
	await hecBridgeSplitterContract.connect(deployer).queue(MANAGING.RESERVE_BRIDGES, lifiBridge);
	await waitSeconds(10);
	await hecBridgeSplitterContract.connect(deployer).toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);
	await waitSeconds(3);
	await hecBridgeSplitterContract.connect(deployer).queue(MANAGING.RESERVE_BRIDGES, squidRouter);
	await waitSeconds(10);
	await hecBridgeSplitterContract.connect(deployer).toggle(MANAGING.RESERVE_BRIDGES, squidRouter);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
