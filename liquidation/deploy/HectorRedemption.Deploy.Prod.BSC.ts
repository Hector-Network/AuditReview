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

//yarn deployRedemption:bsc
const deployHectorRedemption: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0x3CDF52CC28D21C5b7b91d7065fd6dfE6d426FCC5';
  const moderator = '0x4646ea4459cc38498a919B42f05ec6aB09aE267f';
  const redeemToken = '0x4646ea4459cc38498a919B42f05ec6aB09aE267f'; //Irrelevant on Redemption

  /// Token Address: BSC Mainnet
  //https://bscscan.com/address/0x638EEBe886B0e9e7C6929E69490064a6C94d204d
  const hec = '0x638EEBe886B0e9e7C6929E69490064a6C94d204d';
  //https://bscscan.com/address/0x1d6Cbdc6b29C6afBae65444a1f65bA9252b8CA83
  const tor = '0x1d6Cbdc6b29C6afBae65444a1f65bA9252b8CA83';

  const eligibleTokens = [hec, tor];

  //BSC Production
  const hectorRegistration = '0x53ee38495df781816A7FA925f4589BcB3b5f86F3'; //bsc address

  // Deploy LockAddressRegistry
  const lockAccessRegistryFactory = await ethers.getContractFactory(
    'LockAddressRegistry'
  );
  const lockAddressRegistry =
    (await lockAccessRegistryFactory.deploy()) as LockAddressRegistry;

  console.log('LockAddressRegistry: ', lockAddressRegistry.address);

  await waitSeconds(10);

  const lastDayToClaim = 1710633599; //  Saturday, March 16, 2024 11:59:59 PM

  const redemption = await deploy('HectorRedemption', {
    from: deployer.address,
    args: [
      lockAddressRegistry.address,
      hectorRegistration,
      lastDayToClaim,
      eligibleTokens,
    ],
    log: true,
  });
  console.log('Redemption: ', redemption.address);

  await waitSeconds(10);

  await lockAddressRegistry.initialize(
    multisig,
    moderator,
    moderator,
    moderator,
    moderator,
    redeemToken
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
          eligibleTokens,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
  }
};

export default deployHectorRedemption;
deployHectorRedemption.tags = ['HectorRedemptionProdBSC'];
deployHectorRedemption.dependencies = [];
