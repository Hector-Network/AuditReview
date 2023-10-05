import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../../helper/helpers';
import { deployHectorRegistrationContract } from '../../helper/contracts';
import { BigNumber, constants, utils } from 'ethers';
import {
  LockAddressRegistry,
  LockAccessControl,
  FNFT,
  HectorRedemptionTreasury,
  HectorRedemption,
  TokenVault,
  RewardToken2,
  UniswapV2Pair,
} from '../../types';
import { ethers } from 'hardhat';

const deployHectorRedemption: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0x068258e9615415926e8487ce30e3b1006d22f021'; //eth multisig
  const moderator = '0x068258e9615415926e8487ce30e3b1006d22f021';
  const tokenVault = '0x1D322f1B8C48e57b0bB83c3F20Cbfe58a3281f73';
  const lockAddressRegistryAddress =
    '0xbC22fe7294F56D453EfCBf8c474E51349F718Da4';

  const FNFT = '0x047454970f9F33F942cb71D8BcAB96045A515b69';

  //Declare a data structure with 2 fields: token address and RewardToken2 instance
  //this data structure will be used in another data structure
  interface Token {
    address: string;
    instance: RewardToken2 | FNFT;
  }

  interface TokenWithAmount extends Token {
    tokenSymbol: string;
    amount: number;
  }

  interface WalletTokens {
    wallet: string;
    tokens: TokenWithAmount[];
  }

  interface WalletInfo {
    address: string;
    privateKey: string;
  }

  const TOTALWALLETS = 50;

  const eligibleTokens = [
    FNFT,
    '0x5B4C00219A8742c0A52FFE1d987D41bbB1c44E36',
    '0xcCD62f458C81D72050a1710123C0908d34Dc3Bd9',
    '0x87A1B9032666047990F973896FF8Bb845B61D0d1',
    '0xecE00DdcbDAcA582121eE5be25b2ABeFe262E3F1',
    '0x0149691Bd512a392851237d16d2b6B8F87B618F3',
    '0xC78dF94c892F825082094C599dcfBb253B6a9671',
    '0x0Daa577D01edC73d3A3b94671263EF540dA182d7',
    '0x969b3F84A0C72879E74B0A6e1a80937fdD119F3d', //TOR-HEC
    '0xDe5AFcf49C3b37F78894867B780F65564f850004', //HEC-USDC
    '0x0A5472f1a8E3B4C281083494e552c03B835F40f9', //TOR-WFTM
    '0x9a1C6E3FF6c92d0A8Ff009D40A1a2cf02CAEC55d', //HEC-BUSD
    '0x9206BedB956A3a062aA556eEA217318cE0269F0b', //TOR-BUSD
    '0x026cB00123134906b58Cc4F5bE7c34A20eA85363', //TOR_BSC
    '0x7D9d6aE85c4037FE2a9CABb8Ec1B35876cd26163', //HEC_BSC
  ];

  let tokens: { [key: string]: Token } = {};
  //declare a hash table for token names
  let erc20tokenNames: string[] = [
    'FNFT',
    'TOR',
    'HEC',
    'sHEC',
    'wsHEC',
    'anyTOR',
    'oTOR',
    'torHecLP',
    'hecUsdcLP',
    'torWftmLP',
    'hecBusdLP',
    'torBusdLP',
    'torBsc',
    'hecBsc',
  ];

  for (let i = 0; i < erc20tokenNames.length; i++) {
    //If token name is FNFT, then deploy FNFT

    let tokenInstance: RewardToken2 | FNFT = {} as RewardToken2 | FNFT;
    if (erc20tokenNames[i] === 'FNFT') {
      tokenInstance = (await ethers.getContractAt(
        'FNFT',
        eligibleTokens[i]
      )) as FNFT;
    } else {
      tokenInstance = (await ethers.getContractAt(
        'RewardToken2',
        eligibleTokens[i]
      )) as RewardToken2;
    }

    tokens[`${erc20tokenNames[i]}`] = {
      address: eligibleTokens[i],
      instance: tokenInstance,
    };
  }

  //Step 1: Generate 20 test wallets
  let testWallets: { [key: string]: WalletInfo } = {};

  for (let i = 0; i < TOTALWALLETS; i++) {
    const wallet = ethers.Wallet.createRandom();
    testWallets[`testWallet${i}`] = {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };

    //Display wallet private key
    // console.log(`testWallet${i} Private Key: `, wallet.privateKey);
    // console.log(`testWallet${i}: `, wallet.address);
  }

  //Step 2: Randomize the amount of each token in each wallet
  let walletTokens = new Array<WalletTokens>();

  for (let i = 0; i < TOTALWALLETS; i++) {
    //Randomize the nunber of tokens in each wallet from erc20tokenNames.
    //Should be less than or equal to the number of tokens in erc20tokenNames
    let numberOfTokens =
      Math.floor(Math.random() * (erc20tokenNames.length - 5)) + 1;
    //console.log('In wallet ', i, ' numberOfTokens: ', numberOfTokens);

    let tokensInWallet = new Array<TokenWithAmount>();
    for (let j = 0; j < numberOfTokens; j++) {
      let randomTokenIndex = Math.floor(Math.random() * erc20tokenNames.length);
      //Randomize the amount of each token in each wallet from 1 to 10
      let amountOfTokens = Math.floor(Math.random() * 10) + 1;
      let tokenAddress = tokens[erc20tokenNames[randomTokenIndex]].address;

      const isFNFT = tokenAddress === FNFT;

      const token: TokenWithAmount = {
        address: tokenAddress,
        instance: tokens[erc20tokenNames[randomTokenIndex]].instance,
        amount: !isFNFT ? amountOfTokens : 1,
        tokenSymbol: erc20tokenNames[randomTokenIndex],
      };
      tokensInWallet.push(token);
    }

    //console.log('tokensInWallet: ', tokensInWallet);
    walletTokens.push({
      wallet: `testWallet${i}`,
      tokens: tokensInWallet,
    });
  }

  //console.log('walletTokens: ', walletTokens);

  //Step 3: Mint tokens to each wallet
  //setup csv file
  const createCsvWriter = require('csv-writer').createObjectCsvWriter;
  //generate unique csv filename so that it won't get overwritten
  //make sure the file is in the same folder as the script
  const _fileName = 'WalletsGenerated_' + Date.now() + '.csv'; //this will generate a unique filename

  const csvWriter = createCsvWriter({
    path: _fileName,
    header: [
      { id: 'address', title: 'Wallet' },
      { id: 'WalletPrivateKey', title: 'WalletPrivateKey' },
      { id: 'TokenName', title: 'TokenName' },
      { id: 'TokenAddress', title: 'TokenAddress' },
      { id: 'TokenAmount', title: 'TokenAmount' },
      //{ id: 'BlockNumber', title: 'CreatedAtBlockNumber' },
    ],
  });

  for (let i = 0; i < walletTokens.length; i++) {
    console.log(
      'Minting wallet: ',
      i,
      ' (',
      testWallets[walletTokens[i].wallet].address,
      ')'
    );
    for (let j = 0; j < walletTokens[i].tokens.length; j++) {
      const token = walletTokens[i].tokens[j];
      const isFNFT = token.instance.address === FNFT;

      const wallet = testWallets[walletTokens[i].wallet];
      const walletAddress = wallet.address;
      console.log(
        'Minting ',
        token.amount,
        ' ',
        token.instance.address,
        '(',
        token.tokenSymbol,
        ')',
        ' to ',
        walletAddress
      );
      let blockNumber;

      if (!isFNFT) {
        const tx = await token.instance.mint(
          walletAddress,
          utils.parseEther(token.amount.toString())
        );
      } else {
        const tx = await (token.instance as FNFT).mint(walletAddress);
      }

      const records = [
        {
          address: walletAddress,
          WalletPrivateKey: wallet.privateKey,
          TokenName: token.tokenSymbol,
          TokenAddress: token.instance.address,
          TokenAmount: isFNFT ? 1 : token.amount.toString(),
          //BlockNumber: blockNumber.number.toString(),
        },
      ];

      await csvWriter.writeRecords(records).then(() => {});
    }
    //wait for 5 seconds before minting to the next wallet
    await waitSeconds(5);
  }
};

export default deployHectorRedemption;
deployHectorRedemption.tags = ['RedemptionGenerateWallets'];
deployHectorRedemption.dependencies = [];
