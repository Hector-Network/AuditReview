import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
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
  const args = [multisig, moderator];

  const hectorRegistration = await deploy('HectorRegistration', {
    from: deployer.address,
    args: args,
    log: true,
  });

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
