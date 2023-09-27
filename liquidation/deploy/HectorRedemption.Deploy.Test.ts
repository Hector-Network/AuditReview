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
  const multisig = '0x068258e9615415926e8487ce30e3b1006d22f021';
  const moderator = '0x068258e9615415926e8487ce30e3b1006d22f021';

  /// Token Address: FTM Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const fnftAddress = '0xaCeEb6d36a1777746c5c6633C752E688cb6d94A9';

  const eligibleTokens = [hectorTokenAddress, torTokenAddress];
  const args = [multisig, moderator, eligibleTokens, fnftAddress];

  const hectorRegistration = await deploy('HectorRegistration', {
    from: deployer.address,
    args: args,
    log: true,
  });

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

  await waitSeconds(10);

  const redemption = await deploy('HectorRedemption', {
    from: deployer.address,
    args: [lockAddressRegistry.address, hectorRegistration.address],
    log: true,
  });
  console.log('Redemption: ', redemption.address);

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: redemption.address,
        contract: 'contracts/redemption/HectorRedemption.sol:HectorRedemption',
        constructorArguments: [
          lockAddressRegistry.address,
          hectorRegistration.address,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
  }
};

export default deployHectorRedemption;
deployHectorRedemption.tags = ['HectorRedemptionTest'];
deployHectorRedemption.dependencies = [];
