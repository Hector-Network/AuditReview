import { BigNumber } from '@ethersproject/bignumber';
const hre = require('hardhat');
const { ethers } = require('hardhat');
const abi = require('../../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json');
const erc20Abi = require('../../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const tempStepData = require('./tempStepDataForLiFi.json');
import {MANAGING} from '../deployHecBridgeSplitter'
require('dotenv').config();

async function main() {
	let mode = 'single'; // mode: single, multi
	const [deployer] = await hre.ethers.getSigners();
	console.log('Testing account:', deployer.address);
	console.log('Account balance:', (await deployer.getBalance()).toString());
	const SPLITTER_ADDRESS = "0xd85F867DC380F9B64177775CC2A7d716ee7e4a31";

	const HecBridgeSplitterAddress = SPLITTER_ADDRESS;

	const testHecBridgeSplitterContract = new ethers.Contract(
		HecBridgeSplitterAddress,
		abi.abi,
		deployer
	);

	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

	const mockSendingAssetInfos = [];

	console.log('HecBridgeSplitter:', HecBridgeSplitterAddress);

	const isNativeFrom = tempStepData.action.fromToken.address == ZERO_ADDRESS;
	const enableSwap = tempStepData.includedSteps[0].type == 'swap' ? true : false;

	// Step Data
	const originSwapData =
		enableSwap && tempStepData.includedSteps.find((element: any) => element.type == 'swap');

	console.log('Mode:', mode);
	console.log('isNativeFrom:', isNativeFrom);
	console.log('SwapEnable:', enableSwap);

	// Special Data
	let bridgeTool = tempStepData.tool;
	let specialData: any;

	console.log('Bridge:', bridgeTool);

	if (bridgeTool == 'stargate') {
		specialData = tempStepData.estimate.feeCosts.find((element: any) => element.name == 'LayerZero fees');
	}

	let callData = tempStepData.transactionRequest.data;
	let sendingAmount = enableSwap ? originSwapData.action.fromAmount : tempStepData.action.fromAmount; // This is calculated amount except fee for using Bridge
	let totalAmount = BigNumber.from(tempStepData.action.fromAmount)
						.add( BigNumber.from(tempStepData.action.fromAmount).mul(75).div(1000))
						.toString(); // Mock Total Amount
	let feeAmount = BigNumber.from(tempStepData.action.fromAmount)
                        .mul(75).div(1000)
						.toString(); // MockFee - 0.075% 
	let bridgeFee = BigNumber.from(tempStepData.transactionRequest.value)
						.sub(BigNumber.from(tempStepData.action.fromAmount))
						.toString();

	// Sending Asset Data
	const mockSendingAssetInfo1 = {
		callData: callData,
		sendingAmount: sendingAmount,
		totalAmount: totalAmount, // Mock Total Amount
		feeAmount: feeAmount,
		bridgeFee: bridgeFee,
	};

	// Sending Asset Id
	const sendingAsset = tempStepData.action.fromToken.address

	const targetAddress = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";// CallData
    
	// Set Fees
	const fees: Array<BigNumber> = [];

	fees.push(
		BigNumber.from(tempStepData.transactionRequest.value)
	);

	mode == 'multi' &&
		fees.push(
			BigNumber.from(tempStepData.transactionRequest.value)
		);

	let feesForNative: Array<BigNumber> = [];
	if (isNativeFrom) {
		feesForNative.push(BigNumber.from(feeAmount));
		mode == 'multi' &&
			feesForNative.push(BigNumber.from(feeAmount));
	}

	let fee = BigNumber.from(0);

	fees.map((item) => {
		fee = fee.add(item);
	});

	feesForNative.map((item) => {
		fee = fee.add(item);
	})

	mockSendingAssetInfos.push(mockSendingAssetInfo1);

	if (mode == 'multi') {
		mockSendingAssetInfos.push(mockSendingAssetInfo1);
	}

	console.log('mockSendingAssetInfo1:', mockSendingAssetInfo1);

	if (!isNativeFrom) {
		console.log('Approve the ERC20 token to HecBridgeSplitter...');
		let approveAmount;
		if (mode == 'multi' && enableSwap) {
			approveAmount = BigNumber.from(totalAmount).add(
				BigNumber.from(totalAmount)
			);
		}

		if (mode == 'single' && enableSwap) {
			approveAmount = BigNumber.from(totalAmount);
		}

		if (mode == 'multi' && !enableSwap) {
			approveAmount = BigNumber.from(totalAmount).add(
				BigNumber.from(totalAmount)
			);
		}

		if (mode == 'single' && !enableSwap) {
			approveAmount = BigNumber.from(totalAmount);
		}

		const ERC20Contract = new ethers.Contract(
			sendingAsset,
			erc20Abi.abi,
			deployer
		);

		let txApprove = await ERC20Contract.connect(deployer).approve(
			HecBridgeSplitterAddress,
			approveAmount
		);
		await txApprove.wait();
		console.log('Done token allowance setting');
	}

	console.log({ fee: fee.toString(), fees });
	console.log({ useSquid: false, targetAddress });
	console.log('Start bridge...');

	try {
		const result = await testHecBridgeSplitterContract.bridge(
            sendingAsset,
			mockSendingAssetInfos,
			targetAddress,
			{
				value: BigNumber.from(tempStepData.transactionRequest.value),
			}
		);
		const resultWait = await result.wait();
		console.log('Done bridge Tx:', resultWait.transactionHash);
	} catch (e) {
		console.log(e);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
