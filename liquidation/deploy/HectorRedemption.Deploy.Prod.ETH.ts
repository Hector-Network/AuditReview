import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../../helper/helpers';
import { deployHectorRegistrationContract } from '../../helper/contracts';
import {
  LockAddressRegistry,
  LockAccessControl,
  FNFT,
  HectorRedemptionTreasury,
  HectorRedemption,
  TokenVault,
} from '../../types';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

const deployHectorRedemption: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0x4bfb33d65f4167EBE190145939479227E7bf2CB0'; //eth multisig
  const moderator = '0x068258e9615415926e8487ce30e3b1006d22f021';

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

  // Deploy FNFT

  const fnft = await deploy('FNFT', {
    from: deployer.address,
    args: [lockAddressRegistry.address],
    log: true,
  });
  console.log('FNFT: ', fnft.address);

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
    treasury.address
  );

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
        contract: 'contracts/redemption/FNFT.sol:FNFT',
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
