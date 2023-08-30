import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../../helper/helpers';
import { deployHectorRegistrationContract } from '../../helper/contracts';
import { HectorRegistration } from '../../types';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

const deployHectorRegistration: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();
  const multisig = '0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90';
  const moderator = '0x068258e9615415926e8487ce30e3b1006d22f021';

  /// Token Address: FTM Mainnet
  const hec = '0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0';
  //https://ftmscan.com/address/0x75bdeF24285013387A47775828bEC90b91Ca9a5F#readContract
  const sHec = '0x75bdeF24285013387A47775828bEC90b91Ca9a5F';
  //https://ftmscan.com/address/0x94CcF60f700146BeA8eF7832820800E2dFa92EdA#readContract
  const wsHec = '0x94CcF60f700146BeA8eF7832820800E2dFa92EdA';
  //https://ftmscan.com/address/0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e
  const tor = '0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e';
  //https://ftmscan.com/address/0x0b9589A2C1379138D4cC5043cE551F466193c8dE#readContract
  const hec_usdc_lp = '0x0b9589A2C1379138D4cC5043cE551F466193c8dE';
  //https://ftmscan.com/address/0x4339b475399AD7226bE3aD2826e1D78BBFb9a0d9#readContract
  const hec_tor_lp = '0x4339b475399AD7226bE3aD2826e1D78BBFb9a0d9';
  //https://ftmscan.com/address/0x51aEafAC5E4494E9bB2B9e5176844206AaC33Aa3#readContract
  const fnftAddress = '0x51aEafAC5E4494E9bB2B9e5176844206AaC33Aa3';
  //https://ftmscan.com/address/0x41d88635029c4402BF9914782aE55c412f8F2142#code
  const tor_wftm_lp = '0x41d88635029c4402BF9914782aE55c412f8F2142';

  const eligibleTokens = [
    hec,
    tor,
    hec_usdc_lp,
    hec_tor_lp,
    sHec,
    wsHec,
    tor_wftm_lp,
  ];
  const args = [multisig, moderator, eligibleTokens, fnftAddress];

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
deployHectorRegistration.tags = ['HectorRegistrationProd'];
deployHectorRegistration.dependencies = [];
