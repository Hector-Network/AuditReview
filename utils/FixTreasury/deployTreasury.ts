import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitSeconds } from "../helper/helpers";
import { ethers } from "hardhat";
import { RewardToken2, HectorTreasury } from "../types";

async function getImplementationAddress(proxyAddress: string) {
  const implHex = await ethers.provider.getStorageAt(
    proxyAddress,
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  );
  return ethers.utils.hexStripZeros(implHex);
}

const deployTreasury: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [owner] = await ethers.getSigners();

  console.log("owner's address is: ", owner.address);

  let hectorToken: RewardToken2;
  let daiToken: RewardToken2;
  let usdcToken: RewardToken2;
  let dummyToken: RewardToken2;

  /// Token
  const TokenFactory = await ethers.getContractFactory("RewardToken2");
  hectorToken = (await TokenFactory.deploy("Hector", "HEC", 9)) as RewardToken2;
  await waitSeconds(3);

  console.log("hectorToken's address is: ", hectorToken.address);

  //set hec supply
  await hectorToken.setTotalSupply(3571026073183926);
  console.log("setTotalSupply completed");
  await waitSeconds(3);

  daiToken = (await TokenFactory.deploy(
    "DAI Token",
    "DAI",
    18
  )) as RewardToken2;
  console.log("daiToken's address is: ", daiToken.address);

  //await waitSeconds(3);

  const nonce = await owner.getTransactionCount();
  console.log("nonce is: ", nonce);

  /// Treasury
  const params = [hectorToken.address, daiToken.address, 0];
  const HectorTreasuryFactory = await deploy("HectorTreasury", {
    from: owner.address,
    args: params,
    log: true,
    // gasPrice: ethers.utils.parseUnits('10', 'gwei'),
    // nonce: nonce,
  });

  await waitSeconds(3);

  // const HectorTreasuryFactory = await ethers.getContractFactory(
  //   'HectorTreasury'
  // );
  // const treasury = (await HectorTreasuryFactory.deploy(
  //   hectorToken.address,
  //   daiToken.address,
  //   0
  // )) as HectorTreasury;
  const treasury = await ethers.getContract("HectorTreasury", owner);

  //Deposit to treasury to update the Total Reserves
  await treasury.setTotalReserves(4763289508194452);
  await waitSeconds(3);

  let totalReserved = await treasury.totalReserves();
  console.log("totalReserved is: ", totalReserved.toString());

  let excessReserves = await treasury.excessReserves();
  console.log("excessReserves is: ", excessReserves.toString());

  console.log("treasury deployed", treasury.address);

  usdcToken = (await TokenFactory.deploy(
    "USDC Token",
    "USDC",
    6
  )) as RewardToken2;

  console.log("usdcToken's address is: ", usdcToken.address);

  await waitSeconds(3);

  //counterWeightToken = (await TokenFactory.deploy()) as RewardToken2;
  dummyToken = (await TokenFactory.deploy(
    "HECTOR Backup",
    "HECTOR",
    18
  )) as RewardToken2;

  await waitSeconds(3);

  console.log("dummyToken's address is: ", dummyToken.address);

  //add dummy Token as RESERVETOKEN token
  await treasury.queue(2, hectorToken.address);
  await waitSeconds(3);
  await treasury.toggle(2, hectorToken.address, ethers.constants.AddressZero);
  await waitSeconds(3);
  console.log("Toggle Hector completed");

  await treasury.queue(2, daiToken.address);
  await waitSeconds(3);
  await treasury.toggle(2, daiToken.address, ethers.constants.AddressZero);
  await waitSeconds(3);
  console.log("Toggle Dai completed");

  await treasury.queue(2, usdcToken.address);
  await waitSeconds(3);
  await treasury.toggle(2, usdcToken.address, ethers.constants.AddressZero);
  await waitSeconds(3);
  console.log("Toggle Usdc completed");

  await treasury.queue(2, dummyToken.address);
  await waitSeconds(3);
  await treasury.toggle(2, dummyToken.address, ethers.constants.AddressZero);
  await waitSeconds(3);
  console.log("Toggle Hector backup completed");

  //add owner as RESERVEDEPOSITOR(0), liquidity manager(6), RESERVEMANAGER (3)
  await treasury.queue(3, owner.address);
  await waitSeconds(3);
  await treasury.toggle(3, owner.address, ethers.constants.AddressZero);
  await waitSeconds(3);
  console.log("Toggle Owner completed");

  await hectorToken.mint(treasury.address, 92951376930967);
  await waitSeconds(3);

  const hecBalance = await hectorToken.balanceOf(treasury.address);
  console.log("hecBalance is: ", hecBalance.toString());

  await daiToken.mint(
    treasury.address,
    ethers.utils.parseEther("1828286.914633452324705246")
  );
  await waitSeconds(3);

  const daiBalance = await daiToken.balanceOf(treasury.address);
  console.log("daiBalance is: ", daiBalance.toString());

  await usdcToken.mint(treasury.address, 2935002593561);

  await waitSeconds(3);
  const usdcBalance = await usdcToken.balanceOf(treasury.address);
  console.log("usdcBalance is: ", usdcBalance.toString());

  //1192263435010526
  //2935002593561000

  //withdraw usdc amount
  // await treasury.manage(usdcToken.address, 2935002593561);
  // await waitSeconds(3);

  console.log("Minting dummy token....");
  await dummyToken.mint(treasury.address, ethers.utils.parseEther("6000000"));
  await waitSeconds(3);
  console.log("Minting dummy completed....");

  totalReserved = await treasury.totalReserves();
  console.log("BEFORE - totalReserved is: ", totalReserved.toString());

  excessReserves = await treasury.excessReserves();
  console.log("BEFORE - DEBT CEILING is: ", excessReserves.toString());

  console.log("Updating reserves...");
  await treasury.auditReserves();
  console.log("Updating completed...");

  excessReserves = await treasury.excessReserves();
  console.log("AFTER - DEBT CEILING is: ", excessReserves.toString());

  const ownerBalance = await usdcToken.balanceOf(owner.address);
  const ownerDaibalance = await daiToken.balanceOf(owner.address);
  const ownerHecbalance = await hectorToken.balanceOf(owner.address);
  console.log("BEFORE - owner Balance of USDC is: ", ownerBalance.toString());
  console.log("BEFORE - owner Balance of DAI is: ", ownerDaibalance.toString());
  console.log("BEFORE - owner Balance of HEC is: ", ownerHecbalance.toString());

  //withdraw usdc amount
  console.log("Withdrawing all USDC...");
  await treasury.manage(usdcToken.address, 2935002593561);
  await waitSeconds(3);

  console.log("Withdrawing all DAI...");
  await treasury.manage(
    daiToken.address,
    ethers.utils.parseEther("1828286.914633452324705246")
  );
  await waitSeconds(3);

  console.log("Withdrawing all HEC...");
  await treasury.manage(hectorToken.address, 92951376930967);
  await waitSeconds(3);

  const ownerPostBalance = await usdcToken.balanceOf(owner.address);
  console.log("AFTER - ownerBalance of USDC is: ", ownerPostBalance.toString());
  const ownerPostDaibalance = await daiToken.balanceOf(owner.address);
  console.log(
    "AFTER - ownerBalance of DAI is: ",
    ownerPostDaibalance.toString()
  );
  const ownerPostHecbalance = await hectorToken.balanceOf(owner.address);
  console.log(
    "AFTER - ownerBalance of HEC is: ",
    ownerPostHecbalance.toString()
  );

  /// VERIFY ///
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    await waitSeconds(10);
    console.log("=====> Verifing ....");
    try {
      await hre.run("verify:verify", {
        address: treasury.address,
        contract: "contracts/HectorTreasury.sol:HectorTreasury",
        constructorArguments: params,
      });
    } catch (_) {}
    await waitSeconds(3);
    try {
      await hre.run("verify:verify", {
        address: hectorToken.address,
        contract: "contracts/oracle/RewardToken2.sol:RewardToken2",
        constructorArguments: [],
      });
    } catch (_) {}
    await waitSeconds(3);
    try {
      await hre.run("verify:verify", {
        address: daiToken.address,
        contract: "contracts/oracle/RewardToken2.sol:RewardToken2",
        constructorArguments: [],
      });
    } catch (_) {}
    await waitSeconds(3);
    try {
      await hre.run("verify:verify", {
        address: usdcToken.address,
        contract: "contracts/oracle/RewardToken2.sol:RewardToken2",
        constructorArguments: [],
      });
    } catch (_) {}
    await waitSeconds(3);
    try {
      await hre.run("verify:verify", {
        address: dummyToken.address,
        contract: "contracts/oracle/RewardToken2.sol:RewardToken2",
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployTreasury;
deployTreasury.tags = ["deployTreasury"];
