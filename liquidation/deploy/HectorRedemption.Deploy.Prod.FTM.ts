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

//yarn deployRedemption:ftm
const deployHectorRedemption: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0x2ba5F2ce103A45e278D7Bc99153190eD6E9c4A96';
  const moderator = '0x4646ea4459cc38498a919B42f05ec6aB09aE267f';
  const redeemToken = '0x4646ea4459cc38498a919B42f05ec6aB09aE267f'; //Irrelevant on Redemption

  /// Token Address: FTM Mainnet
  const hec = '0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0';
  //https://ftmscan.com/address/0x75bdeF24285013387A47775828bEC90b91Ca9a5F#readContract
  const sHec = '0x75bdeF24285013387A47775828bEC90b91Ca9a5F';
  //https://ftmscan.com/address/0x94CcF60f700146BeA8eF7832820800E2dFa92EdA#readContract
  const wsHec = '0x94CcF60f700146BeA8eF7832820800E2dFa92EdA';
  //https://ftmscan.com/address/0x74e23df9110aa9ea0b6ff2faee01e740ca1c642e
  const tor = '0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e';
  //https://ftmscan.com/address/0x22696aabeb0731de8653f3af58edd9f257a1723c
  const owsHEC = '0x22696aabeb0731de8653f3af58edd9f257a1723c';
  //https://ftmscan.com/address/0x8564bA78F88B744FcC6F9407B9AF503Ad35adAFC
  const anyHEC = '0x8564bA78F88B744FcC6F9407B9AF503Ad35adAFC';
  //https://ftmscan.com/address/0xfF7B22053219eDf569499A3794829FB71D6F8821
  const anyTOR = '0xfF7B22053219eDf569499A3794829FB71D6F8821';
  //https://ftmscan.com/address/0xead86ecad339c897a34415b9f28e746a7529a218
  const oTOR = '0xead86ecad339c897a34415b9f28e746a7529a218';

  const eligibleTokens = [hec, tor, sHec, wsHec, owsHEC, anyHEC, anyTOR, oTOR];

  //FTM Production
  const hectorRegistration = '0x77de88de9ef8FE51ce217C3960a804f57723AB7c';

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
deployHectorRedemption.tags = ['HectorRedemptionProdFTM'];
deployHectorRedemption.dependencies = [];
