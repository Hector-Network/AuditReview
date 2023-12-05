import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../../helper/helpers';
import { deployHectorRegistrationContract } from '../../helper/contracts';
import {
  LockAddressRegistry,
  LockAccessControl,
  RedemptionNFT,
  HectorRedemptionTreasury,
  HectorRedemption,
  TokenVault,
} from '../../types';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

//yarn deployRedemption:eth
const deployHectorRedemption: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0x4bfb33d65f4167EBE190145939479227E7bf2CB0'; //eth multisig
  const moderator = '0xdE5E7715AB1d80B65f074B3d201e1FB1CB5aD32a';
  const redeemToken = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; //USDC on ETH

  // Deploy LockAddressRegistry
  const lockAccessRegistryFactory = await ethers.getContractFactory(
    'LockAddressRegistry'
  );
  const lockAddressRegistry =
    (await lockAccessRegistryFactory.deploy()) as LockAddressRegistry;

  console.log('LockAddressRegistry: ', lockAddressRegistry.address);

  await waitSeconds(10);

  // Deploy TokenVault
  const tokenVault = await deploy('TokenVault', {
    from: deployer.address,
    args: [lockAddressRegistry.address],
    log: true,
  });
  console.log('TokenVault: ', tokenVault.address);
  await waitSeconds(10);

  // Deploy RedemptionNFT

  const fnft = await deploy('RedemptionNFT', {
    from: deployer.address,
    args: [lockAddressRegistry.address],
    log: true,
  });
  console.log('RedemptionNFT: ', fnft.address);

  await waitSeconds(10);

  // Deploy Treasury
  const treasury = await deploy('HectorRedemptionTreasury', {
    from: deployer.address,
    args: [lockAddressRegistry.address],
    log: true,
  });
  console.log('Treasury: ', treasury.address);

  await waitSeconds(10);

  await lockAddressRegistry.initialize(
    multisig,
    moderator,
    tokenVault.address,
    fnft.address,
    treasury.address,
    redeemToken
  );
  console.log('Initialized LockAddressRegistry');

  await waitSeconds(10);

  //add vault as a moderator
  await lockAddressRegistry.setModerator(tokenVault.address, true);
  console.log('setModerator: ', tokenVault.address);

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: lockAddressRegistry.address,
        contract:
          'contracts/redemption/LockAddressRegistry.sol:LockAddressRegistry',
        constructorArguments: [],
      });
    } catch (_) {}
    await waitSeconds(10);

    try {
      await hre.run('verify:verify', {
        address: treasury.address,
        contract:
          'contracts/redemption/HectorRedemptionTreasury.sol:HectorRedemptionTreasury',
        constructorArguments: [lockAddressRegistry.address],
      });
    } catch (_) {}
    await waitSeconds(10);

    try {
      await hre.run('verify:verify', {
        address: fnft.address,
        contract: 'contracts/redemption/FNFT.sol:RedemptionNFT',
        constructorArguments: [lockAddressRegistry.address],
      });
    } catch (_) {}
    await waitSeconds(10);

    try {
      await hre.run('verify:verify', {
        address: tokenVault.address,
        contract: 'contracts/redemption/TokenVault.sol:TokenVault',
        constructorArguments: [lockAddressRegistry.address],
      });
    } catch (_) {}
    await waitSeconds(10);
  }
};

export default deployHectorRedemption;
deployHectorRedemption.tags = ['HectorRedemptionProdETH'];
deployHectorRedemption.dependencies = [];
