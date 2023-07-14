import { BigNumber } from '@ethersproject/bignumber';
const hre = require('hardhat');
const { ethers } = require('hardhat');
const abi = require('../../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json');
const erc20Abi = require('../../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const tempStepData = require('./dataForWithdrawTestCase.json');
import {MANAGING} from '../deployHecBridgeSplitter'
require('dotenv').config();

async function main() {
	let mode = 'single'; // mode: single, multi
	const [deployer] = await hre.ethers.getSigners();
	console.log('Testing account:', deployer.address);
	console.log('Account balance:', (await deployer.getBalance()).toString());
	const SPLITTER_ADDRESS = "0x5357277562d30E29658931Af9A88adA23EB5ecB1";

	const HecBridgeSplitterAddress = SPLITTER_ADDRESS;

	const testHecBridgeSplitterContract = new ethers.Contract(
		HecBridgeSplitterAddress,
		abi.abi,
		deployer
	);

	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

	const mockSendingAssetInfos = [];

	console.log('HecBridgeSplitter:', HecBridgeSplitterAddress);

	const isNativeFrom = tempStepData.params.fromToken.address == ETH_ADDRESS;

	console.log('Mode:', mode);
	console.log('isNativeFrom:', isNativeFrom);

	// Sending Asset Info
	const mockSendingAssetInfo1 = {
		callData: tempStepData.transactionRequest.data,
		sendingAmount: tempStepData.params.fromAmount, // This is calculated amount except fee for using Bridge 
		totalAmount: BigNumber.from(tempStepData.params.fromAmount)
						.add(BigNumber.from(tempStepData.params.fromAmount).div(10))
						.toString(), // Mock Total Amount
		feeAmount: BigNumber.from(tempStepData.params.fromAmount).div(10).toString(),
		bridgeFee: BigNumber.from(tempStepData.transactionRequest.value)
						.sub(BigNumber.from(tempStepData.params.fromAmount))
						.sub(BigNumber.from(tempStepData.params.fromAmount).div(10))
						.toString(),
	};

	// Sending Asset Id
	const sendingAsset = isNativeFrom
		? ZERO_ADDRESS
		: tempStepData.params.fromToken.address;
	const targetAddress = tempStepData.transactionRequest.targetAddress;

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
		feesForNative.push(BigNumber.from(mockSendingAssetInfo1.feeAmount));
		mode == 'multi' &&
			feesForNative.push(BigNumber.from(mockSendingAssetInfo1.feeAmount));
	}

	let fee: BigNumber = BigNumber.from(0);

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

	console.log("sendingAsset:", sendingAsset);
	console.log('mockSendingAssetInfos:', mockSendingAssetInfos);
	console.log("callTargetAddress:", targetAddress);

	if (!isNativeFrom) {
		console.log('Approve the ERC20 token to HecBridgeSplitter...');
		let approveAmount;

		if (mode == 'single') {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount);
		}

		if (mode == 'multi') {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount).add(
				BigNumber.from(mockSendingAssetInfo1.totalAmount)
			);
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
	console.log({ useSquid: true, targetAddress });
	console.log('Start bridge...');

	console.log({
			value: BigNumber.from("100000")
				.add(BigNumber.from(tempStepData.transactionRequest.value))
				.add(BigNumber.from(tempStepData.params.fromAmount).div(10)).toString()
		})
	try {
		const result = await testHecBridgeSplitterContract.bridgeNative(
			mockSendingAssetInfos,
			targetAddress,
			{
				value: BigNumber.from("0")
					.add(BigNumber.from(tempStepData.transactionRequest.value))
					.add(BigNumber.from(tempStepData.params.fromAmount).div(10))
			}
		);
		const resultWait = await result.wait();
		console.log('Done bridge Tx:', resultWait.transactionHash);
		console.log("Withdraw native token from contract:")

		const array = []
		array.push(ZERO_ADDRESS)

		let tx = await testHecBridgeSplitterContract.withdrawTokens(array)
		const txResult = await tx.wait();
		console.log('Done Tx:', txResult.transactionHash);
	} catch (e) {
		console.log(e);
	}

	
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
