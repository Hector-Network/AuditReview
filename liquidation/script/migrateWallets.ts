import { BigNumber } from 'ethers';
import { waitSeconds } from '../helper';
import { HectorRegistration } from '../types';
import { ethers } from 'hardhat';

const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const registerContractAddress = '0x26834b17926A3F5C461B16766002Aa8c854eDC1D'; //1905 wallets
  const newRegisterContractAddress =
    '0x4b3Cf1639346dD953c173Bb3faB1B994eD9AD843';
  //const newRegisterContractAddress = '0x9746538deE1b2E34E2954AA22D3Af4b24a427B1e';    //1905 wallets

  const oldRegistration = (await ethers.getContractAt(
    'HectorRegistration',
    registerContractAddress
  )) as HectorRegistration;

  const newRegistration = (await ethers.getContractAt(
    'HectorRegistration',
    newRegisterContractAddress
  )) as HectorRegistration;

  //get a list of all wallets

  const wallets = await oldRegistration.getAllWallets();
  const CHUNK = 20;
  for (let i = 0; i < wallets.length; i += CHUNK) {
    const _wallets = wallets.slice(i, i + CHUNK);
    console.log(_wallets);
    // break;
    await newRegistration.registerWallets(wallets.slice(i, i + CHUNK));
    console.log('Registered wallets');

    await waitSeconds(5);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
