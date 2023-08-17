import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { deployHectorRegistrationContract } from './../helper/contracts';
import { HectorRegistration } from './../types';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

const deployHectorRegistration: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
  const moderator = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  /// Token Address: FTM Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';

  /// Token Address: BSC Testnet
  // const hectorTokenAddress = '0x7400E9838BAD5cfFe1C4dc0236Fce2E725C73d42';
  // const torTokenAddress = '0x205F190776C8d466727bD0Cac6D1B564DC3C8Ea9';

  const eligibleTokens = [hectorTokenAddress, torTokenAddress];
  const args = [multisig, moderator, eligibleTokens];

  const hectorRegistration = await deploy('HectorRegistration', {
    from: deployer.address,
    args: args,
    log: true,
  });

  // const HectorRegistrationFactory = await ethers.getContractFactory(
  //   'HectorRegistration'
  // );
  // const hectorRegistration = (await HectorRegistrationFactory.deploy(
  //   multisig,
  //   moderator,
  //   eligibleTokens
  // )) as HectorRegistration;

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: hectorRegistration.address,
        contract:
          'contracts/registration/HectorRegistration.sol:HectorRegistration',
        constructorArguments: args,
      });
    } catch (_) {}
    await waitSeconds(10);
  }
};

export default deployHectorRegistration;
deployHectorRegistration.tags = ['HectorRegistration'];
deployHectorRegistration.dependencies = [];
