import { BigNumber } from 'ethers';
import { waitSeconds } from '../../helper';
const hre = require("hardhat");
import { MANAGING } from '../deployHecBridgeSplitter';
async function main() {
	const [deployer] = await hre.ethers.getSigners();
	const _countDest = 2; // Count of the destination wallets, default: 2
	const lifiBridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
	const squidRouter = "0xce16f69375520ab01377ce7b88f5ba8c48f8d666";

	const feePercentage = 75;
	const DAO = "";
	const version = "2.0";

	const chainID = '1285'
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
		[_countDest, 0, DAO],
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
				await tx.wait();
				queueSuccess = true;
				console.log("Queue tokens", i + 1, "out of ", Math.floor(tokenList.length / tokenLimitQueue) + 1)
			} catch (error) {
				console.error("Queue transaction failed. Retrying...");
			}
			await waitSeconds(5);
		}
		await waitSeconds(5);
	}

	for(let i = 0; i < Math.floor(tokenList.length / tokenLimitToggle) + 1; i ++){
		let tokens
		if(tokenLimitToggle * (i + 1) - 1 > tokenList.length) 
			tokens = tokenList.slice(i * tokenLimitToggle, tokenList.length)
		else tokens = tokenList.slice(i * tokenLimitToggle, tokenLimitToggle * (i + 1))
		let toggleSuccess = false
		while (!toggleSuccess) {
			try{
				const tx1 = await hecBridgeSplitterContract.connect(deployer).toggleMany(MANAGING.RESERVE_BRIDGE_ASSETS, tokens);
				await tx1.wait();
				console.log("Toggle tokens", i + 1, "out of ", Math.floor(tokenList.length / tokenLimitToggle) + 1)
				toggleSuccess = true
			}catch(error){
				console.error("Toggle transaction failed. Retrying...");
			}
			await waitSeconds(5);
		}
		await waitSeconds(5);
	}}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
