import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { getTokenList } from '../scripts/getTokenAddress';

export enum MANAGING {
  RESERVE_BRIDGES = 0,
  RESERVE_BRIDGE_ASSETS = 1,
}

async function getImplementationAddress(proxyAddress: string) {
  const implHex = await ethers.provider.getStorageAt(
    proxyAddress,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  );
  return ethers.utils.hexStripZeros(implHex);
}

const deployFTM: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const _countDest = 2; // Count of the destination wallets, default: 2
  const lifiBridge = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
  const squidRouter = '0xce16f69375520ab01377ce7b88f5ba8c48f8d666';
  const upgradeableAdmin = '0x45D2a1f4e76523e74EAe9aCE2d765d527433705a';

  const feePercentage = 75;
  const DAO = '0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90';
  const version = '2.0';

  const chainID = '137';
  const tokenLimitQueue = 20;

  const tokenList = await getTokenList(chainID);

  const multiSigAddress = '0x2ba5F2ce103A45e278D7Bc99153190eD6E9c4A96'; //Fantom
  const multiSigDevAddress = '0xE693aD983eCdfE91F0E47992D869CEA60df425Be'; //Fantom

  console.log('Deploying contracts with the account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  console.log('Gas Price: ', gas);

  console.log('Supported token addresses count:', tokenList.length);

  console.log('Deploying HecBridgeSplitter Contract...');
  const bridgeList = [lifiBridge, squidRouter];

  const params = [_countDest, 0, feePercentage, DAO, version];
  //const params = [_countDest, 0, feePercentage];

  const HecBridgeSplitterContract = await deploy('HecBridgeSplitter', {
    from: deployer.address,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: params,
      },
    },
  });

  const hectorBridgeImplementation = await getImplementationAddress(
    HecBridgeSplitterContract.address
  );

  const hecBridgeSplitterContract = await ethers.getContract(
    'HecBridgeSplitter',
    deployer
  );

  console.log('Queueing bridges ');

  const tx1 = await hecBridgeSplitterContract.queueMany(
    MANAGING.RESERVE_BRIDGES,
    bridgeList
  );
  await waitSeconds(3);
  console.log('Toggling bridges successful ');
  const tx2 = await hecBridgeSplitterContract.toggleMany(
    MANAGING.RESERVE_BRIDGES,
    bridgeList
  );
  await waitSeconds(3);

  console.log(
    'HecBridgeSplitter contract deployed to:',
    HecBridgeSplitterContract.address
  );

  let queueSuccess = false;
  while (!queueSuccess) {
    try {
      const arrLength = tokenList.length;
      const totalChunks = Math.floor(arrLength / tokenLimitQueue) + 1;
      for (let j = 0; j < totalChunks; j++) {
        let chunk;
        if (tokenLimitQueue * (j + 1) - 1 > arrLength)
          chunk = tokenList.slice(j * tokenLimitQueue, arrLength);
        else
          chunk = tokenList.slice(
            j * tokenLimitQueue,
            tokenLimitQueue * (j + 1)
          );

        console.log(
          'Chunk size: ',
          chunk.length,
          ' for chunk ',
          j + 1,
          ' of ',
          totalChunks,
          ' chunks'
        );

        const tx1 = await hecBridgeSplitterContract.queueMany(
          MANAGING.RESERVE_BRIDGE_ASSETS,
          chunk
        );
        await waitSeconds(3);
        console.log('Queueing tokens successful for chunk ', j + 1);
        const tx2 = await hecBridgeSplitterContract.toggleMany(
          MANAGING.RESERVE_BRIDGE_ASSETS,
          chunk
        );
        await waitSeconds(3);
        console.log('Toggling tokens successful for chunk ', j + 1);

        const totalAssets =
          await hecBridgeSplitterContract.getReserveBridgeAssetsCount();
        console.log('Total tokens assets: ', totalAssets.toString());
      }
      queueSuccess = true;
    } catch (error) {
      console.error('Queue transaction failed. Retrying...');
    }
    await waitSeconds(5);
  }

  //add multisig as moderator
  console.log('Adding multisig as moderator...');

  await hecBridgeSplitterContract.setModerator(multiSigAddress, true);
  await waitSeconds(3);

  //add dev multisig as moderator
  console.log('Adding dev multisig as moderator...');
  await hecBridgeSplitterContract.setModerator(multiSigDevAddress, true);
  await waitSeconds(3);

  //Set the queueBlock to 8 hrs
  console.log('Setting queueBlock to 8 hrs...');
  await hecBridgeSplitterContract.setBlockQueue(28800);
  await waitSeconds(3);

  //Remove deployer from moderator
  console.log('Removing deployer as moderator...');
  await hecBridgeSplitterContract.setModerator(deployer.address, false);
  await waitSeconds(3);

  //transfer ownership to multisig
  console.log('Transferring ownership to multisig...');
  await hecBridgeSplitterContract.transferOwnership(multiSigAddress);
  await waitSeconds(3);

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: hectorBridgeImplementation,
        contract: 'contracts/HecBridgeSplitter.sol:HecBridgeSplitter',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployFTM;
deployFTM.tags = ['bridgeFTM'];
