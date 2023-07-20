import { BigNumber } from 'ethers';
import { waitSeconds } from '../../helper';
const hre = require("hardhat");
import { MANAGING } from '../deployHecBridgeSplitter';
import { getTokenList } from '../getTokenAddress';

async function main() {
	const [deployer] = await hre.ethers.getSigners();
	const _countDest = 2; // Count of the destination wallets, default: 2
	const lifiBridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
	const squidRouter = "0xce16f69375520ab01377ce7b88f5ba8c48f8d666";

	const feePercentage = 75;
	const DAO = "0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90";
	const version = "2.0";

	const chainID = '137'
	const tokenLimitQueue = process.env.polygonTokenLimitQueue ? parseInt(process.env.polygonTokenLimitQueue) : 400
	const tokenLimitToggle = process.env.polygonTokenLimitToggle ? parseInt(process.env.polygonTokenLimitToggle) : 40
	const tokenList = await getTokenList(chainID)

	console.log("Deploying contracts with the account:", deployer.address);
	console.log("Account balance:", (await deployer.getBalance()).toString());

	const gas = await ethers.provider.getGasPrice();
	console.log("Gas Price: ", gas);
	
	console.log("Supported token addresses count:", tokenList.length)
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
	const tx = await hecBridgeSplitterContract.connect(deployer).queueMany(MANAGING.RESERVE_BRIDGES, [lifiBridge, squidRouter]);
	await tx.wait();
	await waitSeconds(3);
	await hecBridgeSplitterContract.connect(deployer).toggleMany(MANAGING.RESERVE_BRIDGES, [lifiBridge, squidRouter]);

	for(let i = 0; i < Math.floor(tokenList.length / tokenLimitQueue) + 1; i ++){
		let tokens
		if(tokenLimitQueue * (i + 1) - 1 > tokenList.length) 
			tokens = tokenList.slice(i * tokenLimitQueue, tokenList.length)
		else tokens = tokenList.slice(i * tokenLimitQueue, tokenLimitQueue * (i + 1))
		
		let queueSuccess = false;
		while (!queueSuccess) {
			try {
				const tx = await hecBridgeSplitterContract.connect(deployer).queueMany(MANAGING.RESERVE_BRIDGE_ASSETS, tokens);
				await waitSeconds(3);
				const tx1 = await hecBridgeSplitterContract.connect(deployer).toggleMany(MANAGING.RESERVE_BRIDGE_ASSETS, tokens);
				await waitSeconds(3);
				queueSuccess = true;
				console.log("Queue tokens", i + 1, "out of ", Math.floor(tokenList.length / tokenLimitQueue) + 1)
			} catch (error) {
				console.error("Queue transaction failed. Retrying...");
			}
			await waitSeconds(5);
		}
		await waitSeconds(5);
	}	 
	
	//Remove deployer from moderator
	await hecBridgeSplitterContract.setModerator(deployer.address, false);

	//add multisig as moderator 
	const multiSigAddress = '0x2ba5F2ce103A45e278D7Bc99153190eD6E9c4A96';	//Fantom
	const multiSigDevAddress = '0xE693aD983eCdfE91F0E47992D869CEA60df425Be';	//Fantom

	await hecBridgeSplitterContract.setModerator(multiSigAddress, true);

	//add dev multisig as moderator
	await hecBridgeSplitterContract.setModerator(multiSigDevAddress, true);

	//Set the queueBlock to 8 hrs
	await hecBridgeSplitterContract.setBlockQueue(28800);

	//transfer ownership to multisig
	await hecBridgeSplitterContract.transferOwnership(multiSigAddress);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
