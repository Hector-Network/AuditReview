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

  const hectorRegistration = '0x26834b17926A3F5C461B16766002Aa8c854eDC1D';

  // Deploy LockAddressRegistry
  const lockAccessRegistryFactory = await ethers.getContractFactory(
    'LockAddressRegistry'
  );
  const lockAddressRegistry =
    (await lockAccessRegistryFactory.deploy()) as LockAddressRegistry;

  console.log('LockAddressRegistry: ', lockAddressRegistry.address);

  await waitSeconds(10);

  const redemption = await deploy('HectorRedemption', {
    from: deployer.address,
    args: [lockAddressRegistry.address, hectorRegistration],
    log: true,
  });
  console.log('Redemption: ', redemption.address);

  await waitSeconds(10);

  await lockAddressRegistry.initialize(
    multisig,
    moderator,
    moderator,
    moderator,
    moderator
  );

  await waitSeconds(10);

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: redemption.address,
        contract: 'contracts/redemption/HectorRedemption.sol:HectorRedemption',
        constructorArguments: [lockAddressRegistry.address, hectorRegistration],
      });
    } catch (_) {}
    await waitSeconds(10);
  }
};

export default deployHectorRedemption;
deployHectorRedemption.tags = ['HectorRedemptionProdFTM'];
deployHectorRedemption.dependencies = [];
