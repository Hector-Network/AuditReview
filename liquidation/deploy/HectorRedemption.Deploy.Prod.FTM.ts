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

//yarn deployRedemption:ftm
const deployHectorRedemption: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0x4646ea4459cc38498a919B42f05ec6aB09aE267f';
  const moderator = '0x4646ea4459cc38498a919B42f05ec6aB09aE267f';

  //FTM Production
  const hectorRegistration = '0x4b3Cf1639346dD953c173Bb3faB1B994eD9AD843';

  // Deploy LockAddressRegistry
  const lockAccessRegistryFactory = await ethers.getContractFactory(
    'LockAddressRegistry'
  );
  const lockAddressRegistry =
    (await lockAccessRegistryFactory.deploy()) as LockAddressRegistry;

  console.log('LockAddressRegistry: ', lockAddressRegistry.address);

  await waitSeconds(10);

  const lastDayToClaim = 1709251199000; //  Thursday, February 29, 2024 11:59:59 PM

  const redemption = await deploy('HectorRedemption', {
    from: deployer.address,
    args: [lockAddressRegistry.address, hectorRegistration, lastDayToClaim],
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
        constructorArguments: [
          lockAddressRegistry.address,
          hectorRegistration,
          lastDayToClaim,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
  }
};

export default deployHectorRedemption;
deployHectorRedemption.tags = ['HectorRedemptionProdFTM'];
deployHectorRedemption.dependencies = [];
