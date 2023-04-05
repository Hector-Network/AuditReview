import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';

const deployPay: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: Mainnet
  //   const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';

  /// Token Address: FTM Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  /// Token Address: BSC Testnet
  // const hectorTokenAddress = '0x7400E9838BAD5cfFe1C4dc0236Fce2E725C73d42';
  // const torTokenAddress = '0x205F190776C8d466727bD0Cac6D1B564DC3C8Ea9';
  // const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  const hectorMultiPayProduct = 'Hector Multi Pay';
  const upgradeableAdmin = '0x45D2a1f4e76523e74EAe9aCE2d765d527433705a';

  /// SUBSCRIPTION ///
  const subscriptionLogic = await deploy('HectorSubscription', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const subscriptionParams = [subscriptionLogic.address, upgradeableAdmin];
  const subscriptionFactory = await deploy('HectorSubscriptionFactory', {
    from: deployer.address,
    args: subscriptionParams,
    log: true,
  });
  const subscriptionFactoryContract = await ethers.getContract(
    'HectorSubscriptionFactory',
    deployer
  );

  await waitSeconds(10);
  try {
    (
      await subscriptionFactoryContract.createHectorSubscriptionContract(
        hectorMultiPayProduct,
        treasury
      )
    ).wait();
  } catch (_) {}

  await waitSeconds(10);
  const paySubscription =
    await subscriptionFactoryContract.getHectorSubscriptionContractByName(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hectorMultiPayProduct))
    );
  const paySubscriptionContract = await ethers.getContractAt(
    'HectorSubscription',
    paySubscription,
    deployer
  );

  const plans = [
    // Small For 3 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 90,
      amount: ethers.utils.parseEther('80').mul(3),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(20), 32),
    },
    // Small For 6 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 180,
      amount: ethers.utils.parseEther('80').mul(6).mul(85).div(100),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(20), 32),
    },
    // Small For 1 Year
    {
      token: torTokenAddress,
      period: 3600 * 24 * 365,
      amount: ethers.utils.parseEther('80').mul(12).mul(70).div(100),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(20), 32),
    },

    // Medium For 3 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 90,
      amount: ethers.utils.parseEther('123').mul(3),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(30), 32),
    },
    // Medium For 6 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 180,
      amount: ethers.utils.parseEther('123').mul(6).mul(85).div(100),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(30), 32),
    },
    // Medium For 1 Year
    {
      token: torTokenAddress,
      period: 3600 * 24 * 365,
      amount: ethers.utils.parseEther('123').mul(12).mul(70).div(100),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(30), 32),
    },

    // Large For 3 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 90,
      amount: ethers.utils.parseEther('200').mul(3),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(50), 32),
    },
    // Large For 6 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 180,
      amount: ethers.utils.parseEther('200').mul(6).mul(85).div(100),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(50), 32),
    },
    // Large For 1 Year
    {
      token: torTokenAddress,
      period: 3600 * 24 * 365,
      amount: ethers.utils.parseEther('200').mul(12).mul(70).div(100),
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(50), 32),
    },

    // Enterprise For 3 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 90,
      amount: ethers.utils.parseEther('250').mul(3),
      data: ethers.utils.hexZeroPad(
        ethers.utils.hexlify(ethers.constants.MaxUint256),
        32
      ),
    },
    // Enterprise For 6 Months
    {
      token: torTokenAddress,
      period: 3600 * 24 * 180,
      amount: ethers.utils.parseEther('250').mul(6).mul(85).div(100),
      data: ethers.utils.hexZeroPad(
        ethers.utils.hexlify(ethers.constants.MaxUint256),
        32
      ),
    },
    // Enterprise For 1 Year
    {
      token: torTokenAddress,
      period: 3600 * 24 * 365,
      amount: ethers.utils.parseEther('250').mul(12).mul(70).div(100),
      data: ethers.utils.hexZeroPad(
        ethers.utils.hexlify(ethers.constants.MaxUint256),
        32
      ),
    },
  ];
  const freePlan = {
    token: ethers.constants.AddressZero,
    period: 0,
    amount: 0,
    data: ethers.utils.hexZeroPad(ethers.utils.hexlify(3), 32),
  };
  await waitSeconds(10);
  try {
    (await paySubscriptionContract.appendPlan(plans)).wait();
  } catch (_) {}
  await waitSeconds(10);
  try {
    (await paySubscriptionContract.updatePlan(0, freePlan)).wait();
  } catch (_) {}

  /// MULTI PAY ///
  const payLogic = await deploy('HectorPay', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const payParams = [payLogic.address, deployer.address, paySubscription];
  const payFactory = await deploy('HectorPayFactory', {
    from: deployer.address,
    args: payParams,
    log: true,
  });
  const payFactoryContract = await ethers.getContract(
    'HectorPayFactory',
    deployer
  );

  await waitSeconds(10);
  try {
    await payFactoryContract.createHectorPayContract(hectorTokenAddress);
  } catch (_) {}

  await waitSeconds(10);
  try {
    await payFactoryContract.createHectorPayContract(torTokenAddress);
  } catch (_) {}

  /// VERIFY ///
  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: subscriptionFactory.address,
        contract:
          'contracts/HectorPay/subscription/HectorSubscriptionFactory.sol:HectorSubscriptionFactory',
        constructorArguments: subscriptionParams,
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: subscriptionLogic.address,
        contract:
          'contracts/HectorPay/subscription/HectorSubscription.sol:HectorSubscription',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: payFactory.address,
        contract:
          'contracts/HectorPay/v1_upfront_pay/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: payParams,
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: payLogic.address,
        contract: 'contracts/HectorPay/v1_upfront_pay/HectorPay.sol:HectorPay',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployPay;
deployPay.tags = ['PayTest'];
deployPay.dependencies = [];
