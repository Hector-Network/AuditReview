import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, constants, utils } from 'ethers';
import { increaseTime, getTimeStamp, waitSeconds } from '../../helper';
import {
  HectorRegistration,
  HectorRedemption,
  HectorRedemptionTreasury,
  TokenVault,
  RewardToken2,
  RedemptionNFT,
  LockAccessControl,
  LockAddressRegistry,
  LeftOverTreasury,
  LPToken,
  UniswapV2Router02,
} from '../../types';
import exp from 'constants';

describe('Hector Redemption', function () {
  let deployer: SignerWithAddress;
  let multisig: SignerWithAddress;
  let moderator: SignerWithAddress;
  let registeredWallet: SignerWithAddress;
  let testWallet1: SignerWithAddress,
    testWallet2: SignerWithAddress,
    testWallet3: SignerWithAddress,
    testWallet4: SignerWithAddress,
    unRegisterWallet: SignerWithAddress;

  let hecToken: RewardToken2,
    wsHec: RewardToken2,
    sHec: RewardToken2,
    unregisteredToken: RewardToken2,
    torToken: RewardToken2;

  let FNFT: RedemptionNFT;
  let RNFT: RedemptionNFT;

  let hectorRegistration: HectorRegistration;
  let hectorRedemption: HectorRedemption;
  let treasury: HectorRedemptionTreasury;
  let vaultFNFT: TokenVault; //For previous FNFT Vault
  let vaultRNFT: TokenVault; //New RNFT Receipt
  let walletAddresses: [];
  let totalWallets: number;

  let lockAccess: LockAccessControl;
  let lockAddressRegistry: LockAddressRegistry;
  let leftOverTreasury: LeftOverTreasury;

  let torHEC: LPToken;
  let uniswapV2Router: UniswapV2Router02;

  before(async function () {
    //this.timeout(10000000);
    [
      deployer,
      multisig,
      moderator,
      registeredWallet,
      testWallet1,
      testWallet2,
      testWallet3,
      testWallet4,
      unRegisterWallet,
    ] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory('RewardToken2');
    hecToken = (await TokenFactory.deploy(
      'HEC Token',
      'HEC',
      9
    )) as RewardToken2;
    torToken = (await TokenFactory.deploy(
      'TOR Token',
      'TOR',
      18
    )) as RewardToken2;
    wsHec = (await TokenFactory.deploy(
      'wsHEC Token',
      'wsHEC',
      18
    )) as RewardToken2;
    sHec = (await TokenFactory.deploy('sHEC Token', 'sHEC', 9)) as RewardToken2;
    unregisteredToken = (await TokenFactory.deploy(
      'UHEC Token',
      'UHEC',
      9
    )) as RewardToken2;

    const LPTokenFactory = await ethers.getContractFactory('LPToken');
    torHEC = (await LPTokenFactory.deploy(
      'TOR-HEC LP',
      'TOR-HEC',
      18,
      torToken.address,
      hecToken.address
    )) as LPToken;

    const UniswapV2Router02Factory = await ethers.getContractFactory(
      'UniswapV2Router02'
    );
    uniswapV2Router =
      (await UniswapV2Router02Factory.deploy()) as UniswapV2Router02;

    let eligibleTokens = [hecToken.address, wsHec.address, sHec.address];

    const lockAccessRegistryFactory = await ethers.getContractFactory(
      'contracts/redemption/LockAddressRegistry.sol:LockAddressRegistry'
    );
    lockAddressRegistry =
      (await lockAccessRegistryFactory.deploy()) as LockAddressRegistry;

    const FNFTFactory = await ethers.getContractFactory('RedemptionNFT');
    FNFT = (await FNFTFactory.deploy(
      lockAddressRegistry.address
    )) as RedemptionNFT;
    RNFT = (await FNFTFactory.deploy(
      lockAddressRegistry.address
    )) as RedemptionNFT;

    //Deploy Registration
    const HectorRegistrationFactory = await ethers.getContractFactory(
      'HectorRegistration'
    );
    hectorRegistration = (await HectorRegistrationFactory.deploy(
      multisig.address,
      moderator.address,
      eligibleTokens,
      RNFT.address
    )) as HectorRegistration;

    //Deploy Redemption
    const HectorRedemptionFactory = await ethers.getContractFactory(
      'HectorRedemption'
    );

    //Get current block time
    const blockTime = await getTimeStamp();
    //set the lastDayToClaim to be 10 minutes from now
    const lastDayToClaim = blockTime + 600;
    hectorRedemption = (await HectorRedemptionFactory.deploy(
      lockAddressRegistry.address,
      hectorRegistration.address,
      lastDayToClaim,
      eligibleTokens
    )) as HectorRedemption;

    //Deploy Treasury
    const HectorTreasuryFactory = await ethers.getContractFactory(
      'HectorRedemptionTreasury'
    );

    treasury = (await HectorTreasuryFactory.deploy(
      lockAddressRegistry.address
    )) as HectorRedemptionTreasury;

    //Deploy LeftOverTreasury
    const LeftOverTreasuryFactory = await ethers.getContractFactory(
      'LeftOverTreasury'
    );

    leftOverTreasury = (await LeftOverTreasuryFactory.deploy(
      hecToken.address,
      lockAddressRegistry.address
    )) as LeftOverTreasury;

    const TokenVaultFactory = await ethers.getContractFactory('TokenVault');
    vaultFNFT = (await TokenVaultFactory.deploy(
      lockAddressRegistry.address
    )) as TokenVault;

    vaultRNFT = (await TokenVaultFactory.deploy(
      lockAddressRegistry.address
    )) as TokenVault;

    // Register Addresses
    await lockAddressRegistry.initialize(
      multisig.address,
      moderator.address,
      vaultRNFT.address,
      RNFT.address,
      treasury.address,
      hecToken.address
    );

    //add vaultRNFT as a moderator
    await lockAddressRegistry.setModerator(vaultRNFT.address, true);
    // await lockAddressRegistry.setModerator(treasury.address, true);
    // await lockAddressRegistry.setModerator(RNFT.address, true);

    //generate 20 wallet addresses to an array
    walletAddresses = [];
    totalWallets = 20;

    // for (let i = 0; i < totalWallets; i++) {
    //   const wallet = ethers.Wallet.createRandom();
    //   walletAddresses.push(wallet.address);
    //   //mint tokens to the wallet
    //   await hecToken.mint(wallet.address, utils.parseEther('1000000'));
    // }

    await hecToken.mint(deployer.address, utils.parseEther('1000000'));
  });

  describe('#Treasury', async () => {
    it('Should Pass - Test Deposit', async function () {
      await hecToken.mint(deployer.address, utils.parseEther('1000000'));
      await hecToken.approve(treasury.address, utils.parseEther('1000000'));

      let tx = await treasury.deposit(
        hecToken.address,
        utils.parseEther('1000000')
      );

      await expect(tx)
        .to.emit(treasury, 'Deposited')
        .withArgs(
          deployer.address,
          hecToken.address,
          utils.parseEther('1000000')
        );
    });

    it('Should Pass - Test Redemption Fund Transfer', async function () {
      const tx = await RNFT.mint(registeredWallet.address);
      expect(await RNFT.balanceOf(registeredWallet.address)).to.equal('1');

      const nftId = await RNFT.tokenOfOwnerByIndex(registeredWallet.address, 0);
      expect(nftId).to.equal('0');

      const balanceBefore = await hecToken.balanceOf(registeredWallet.address);

      let tx1 = await treasury.transferRedemption(
        nftId,
        hecToken.address,
        registeredWallet.address,
        utils.parseEther('1000')
      );

      const balanceAfter = await hecToken.balanceOf(registeredWallet.address);

      await expect(tx1)
        .to.emit(treasury, 'SendRedemption')
        .withArgs(registeredWallet.address, nftId, utils.parseEther('1000'));

      expect(balanceAfter).to.be.equal(
        balanceBefore.add(utils.parseEther('1000'))
      );
    });
    it('Should Fail - No FNFT Receipt', async function () {
      const nftId = 0;

      await expect(
        treasury.transferRedemption(
          nftId,
          hecToken.address,
          testWallet1.address,
          utils.parseEther('1000')
        )
      ).to.be.revertedWith('INVALID_RECIPIENT');
    });
    it('Should Fail - Invalid redeemed token', async function () {
      const nftId = 1;

      await expect(
        treasury.transferRedemption(
          nftId,
          wsHec.address,
          testWallet1.address,
          utils.parseEther('1000')
        )
      ).to.be.revertedWith('INVALID_TOKEN');
    });
    it('Should Fail - Invalid amount', async function () {
      const nftId = 0;

      await expect(
        treasury.transferRedemption(
          nftId,
          hecToken.address,
          registeredWallet.address,
          utils.parseEther('1000000000000000')
        )
      ).to.be.revertedWith('INSUFFICIENT_FUND');
    });
    it('Should Pass - Withdraw all to Treasury owner wallet', async function () {
      const _owner = await treasury.owner();
      let balanceBefore = await hecToken.balanceOf(_owner);
      const treasuryBalanceBefore = await hecToken.balanceOf(treasury.address);

      let tx = await treasury.withdrawAll();
      let balanceAfter = await hecToken.balanceOf(_owner);
      expect(balanceAfter).to.be.equal(
        balanceBefore.add(treasuryBalanceBefore)
      );

      await hecToken.mint(deployer.address, utils.parseEther('1000000'));
      await hecToken.approve(treasury.address, utils.parseEther('1000000'));

      await treasury.deposit(hecToken.address, utils.parseEther('1000000'));
    });
  });

  describe('#Token Vault', async () => {
    it('Should Pass - Mint', async function () {
      await vaultRNFT.addEligibleWallet(
        testWallet4.address,
        utils.parseEther('10')
      );

      const fnftConfig = {
        eligibleTORAmount: 100,
        eligibleHECAmount: 100,
        redeemableToken: hecToken.address,
        redeemableAmount: utils.parseEther('10'),
      };

      let tx = await vaultRNFT
        .connect(moderator)
        .mint(testWallet4.address, fnftConfig);

      await expect(tx)
        .to.emit(vaultRNFT, 'RedeemNFTMinted')
        .withArgs(
          testWallet4.address,
          1,
          fnftConfig.eligibleTORAmount,
          fnftConfig.eligibleHECAmount,
          fnftConfig.redeemableAmount
        );

      expect(await RNFT.balanceOf(testWallet4.address)).to.equal('1');
    });
    it('Should Fail - Duplicated NFT Per Wallet', async function () {
      const fnftConfig = {
        eligibleTORAmount: 100,
        eligibleHECAmount: 100,
        redeemableToken: hecToken.address,
        redeemableAmount: utils.parseEther('10'),
      };

      const balanceBefore = await RNFT.balanceOf(testWallet4.address);

      await expect(
        vaultRNFT.connect(moderator).mint(testWallet4.address, fnftConfig)
      ).to.be.revertedWith('DUPLICATED_NFT');
    });
    it('Should Fail - Mint with Blacklisted Wallet', async function () {
      let fnftConfig = {
        eligibleTORAmount: utils.parseEther('0'),
        eligibleHECAmount: utils.parseEther('0'),
        redeemableToken: hecToken.address,
        redeemableAmount: utils.parseEther('0'),
      };

      const totalBlacklistedWalletsBefore = await vaultRNFT.getBlacklistCount();
      await vaultRNFT.addBlacklistWallets([unRegisterWallet.address]);

      expect(await vaultRNFT.getBlacklistCount()).to.equal(
        totalBlacklistedWalletsBefore.add(1)
      );

      await vaultRNFT.addEligibleWallet(
        unRegisterWallet.address,
        utils.parseEther('10')
      );

      await expect(
        vaultRNFT.connect(moderator).mint(unRegisterWallet.address, fnftConfig)
      ).to.be.revertedWith('BLACKLISTED_RECIPIENT');

      await vaultRNFT.removeEligibleWallet(unRegisterWallet.address);
    });
    it('Should Fail - Mint Fails with Zero Amount', async function () {
      let fnftConfig = {
        eligibleTORAmount: utils.parseEther('0'),
        eligibleHECAmount: utils.parseEther('0'),
        redeemableToken: hecToken.address,
        redeemableAmount: utils.parseEther('0'),
      };

      await vaultRNFT.addEligibleWallet(
        registeredWallet.address,
        utils.parseEther('10')
      );

      await expect(
        vaultRNFT.connect(moderator).mint(registeredWallet.address, fnftConfig)
      ).to.be.revertedWith('INVALID_AMOUNT');

      await vaultRNFT.removeEligibleWallet(registeredWallet.address);
    });
    it('Should Pass - Withdraw', async function () {
      let tx = await vaultRNFT.withdraw(testWallet4.address, 1);

      await expect(tx)
        .to.emit(vaultRNFT, 'RedeemNFTWithdrawn')
        .withArgs(testWallet4.address, 1, utils.parseEther('10'));

      // expect(await RNFT.balanceOf(registeredWallet.address)).to.equal('1');

      // expect(await hecToken.balanceOf(registeredWallet.address)).to.equal(
      //   utils.parseEther('1010')
      // );
    });
    it('Should Fail - Unable to Withdraw due to invalid receipt', async function () {
      await expect(
        vaultRNFT.withdraw(testWallet1.address, 0)
      ).to.be.revertedWith('INVALID_RECIPIENT');
    });
    it('Should Fail - Unable to Withdraw - Receipt Not Found', async function () {
      await vaultRNFT.addEligibleWallet(
        registeredWallet.address,
        utils.parseEther('10')
      );

      await expect(
        vaultRNFT.withdraw(registeredWallet.address, 0)
      ).to.be.revertedWith('INVALID_ADDRESS');

      await vaultRNFT.removeEligibleWallet(registeredWallet.address);
    });
  });

  describe('#Redemption Contract', async () => {
    it('Should Pass - Deposit Token', async function () {
      await hecToken.mint(testWallet1.address, utils.parseEther('1000'));

      await hectorRegistration.registerWallet(testWallet1.address);

      await hecToken
        .connect(testWallet1)
        .approve(hectorRedemption.address, utils.parseEther('1000'));

      let tx = await hectorRedemption
        .connect(testWallet1)
        .deposit(hecToken.address, utils.parseEther('100'));

      await expect(tx)
        .to.emit(hectorRedemption, 'DepositToken')
        .withArgs(hecToken.address, utils.parseEther('100'));

      expect(await hecToken.balanceOf(testWallet1.address)).to.equal(
        utils.parseEther('900')
      );

      expect(await hectorRedemption.getRedeemedWalletsCount()).to.equal('1');

      expect(
        await hectorRedemption.isRedeemedWallet(testWallet1.address)
      ).to.equal(true);

      //Register wallet to TokenVault
      await vaultRNFT
        .connect(moderator)
        .addEligibleWallet(testWallet1.address, utils.parseEther('100'));

      expect(await vaultRNFT.isRegisteredWallet(testWallet1.address)).to.equal(
        true
      );
    });
    it('Should Pass - Add Eligible Token', async function () {
      await unregisteredToken.mint(
        testWallet2.address,
        utils.parseEther('1000')
      );

      await unregisteredToken
        .connect(testWallet2)
        .approve(hectorRedemption.address, utils.parseEther('1000'));

      await hectorRegistration.registerWallet(testWallet2.address);

      await expect(
        hectorRedemption
          .connect(testWallet2)
          .deposit(unregisteredToken.address, utils.parseEther('100'))
      ).to.be.revertedWith('INVALID_PARAM');

      //add new eligible token
      const totalEligibleTokensBefore =
        await hectorRedemption.getEligibleTokensCount();

      await hectorRedemption.addEligibleTokens([unregisteredToken.address]);

      expect(await hectorRedemption.getEligibleTokensCount()).to.equal(
        totalEligibleTokensBefore.add(1)
      );

      let tx = await hectorRedemption
        .connect(testWallet2)
        .deposit(unregisteredToken.address, utils.parseEther('100'));

      //Register wallet to TokenVault
      await vaultRNFT
        .connect(moderator)
        .addEligibleWallet(testWallet2.address, utils.parseEther('100'));

      await expect(tx)
        .to.emit(hectorRedemption, 'DepositToken')
        .withArgs(unregisteredToken.address, utils.parseEther('100'));

      expect(await unregisteredToken.balanceOf(testWallet2.address)).to.equal(
        utils.parseEther('900')
      );

      //remove new eligible token
      await hectorRedemption.removeEligibleToken(unregisteredToken.address);

      expect(await hectorRedemption.getEligibleTokensCount()).to.equal(
        totalEligibleTokensBefore
      );
    });

    it('Failed Deposit Tx when paused', async function () {
      const txPause = await hectorRedemption.pause();

      await expect(
        hectorRedemption
          .connect(testWallet1)
          .deposit(hecToken.address, utils.parseEther('10'))
      ).to.be.revertedWith('Pausable: paused');
    });

    it('Success Deposit Tx when unpaused', async function () {
      const txPause = await hectorRedemption.unpause();

      const tx = await hectorRedemption
        .connect(testWallet1)
        .deposit(hecToken.address, utils.parseEther('10'));

      await expect(tx)
        .to.emit(hectorRedemption, 'DepositToken')
        .withArgs(hecToken.address, utils.parseEther('10'));

      expect(await hectorRedemption.getRedeemedWalletsCount()).to.equal('2');
    });

    it('Should Pass - Burn Tokens', async function () {
      const beforeBalance = await hecToken.balanceOf(hectorRedemption.address);
      let tx = await hectorRedemption.burnTokens();

      const afterBalance = await hecToken.balanceOf(hectorRedemption.address);
      expect(afterBalance).to.be.equal(0);
    });

    it('Should Pass - Withdraw all Tokens', async function () {
      await hecToken.mint(testWallet1.address, utils.parseEther('1000'));

      await hecToken
        .connect(testWallet1)
        .approve(hectorRedemption.address, utils.parseEther('1000'));

      await hectorRedemption
        .connect(testWallet1)
        .deposit(hecToken.address, utils.parseEther('100'));

      const beforeBalance = await hecToken.balanceOf(hectorRedemption.address);
      let tx = await hectorRedemption.withdrawAllTokens();

      const afterBalance = await hecToken.balanceOf(hectorRedemption.address);
      expect(afterBalance).to.be.equal(0);
    });

    it('Should Fail - Deposit with Blacklisted Wallet', async function () {
      const totalBlacklistedWalletsBefore =
        await hectorRedemption.getBlacklistCount();
      await hectorRedemption.addBlacklistWallets([testWallet1.address]);
      expect(await hectorRedemption.getBlacklistCount()).to.equal(
        totalBlacklistedWalletsBefore.add(1)
      );

      await expect(
        hectorRedemption
          .connect(testWallet1)
          .deposit(hecToken.address, utils.parseEther('100'))
      ).to.be.revertedWith('BLACKLISTED_RECIPIENT');
    });

    it('Should Fail - Deposit with Invalid Wallet', async function () {
      await expect(
        hectorRedemption
          .connect(registeredWallet)
          .deposit(hecToken.address, utils.parseEther('100'))
      ).to.be.revertedWith('UNAUTHORIZED_RECIPIENT');
    });
    it('Should Fail - Deposit with Invalid Token', async function () {
      await expect(
        hectorRedemption
          .connect(registeredWallet)
          .deposit(testWallet3.address, utils.parseEther('100'))
      ).to.be.revertedWith('INVALID_PARAM');
    });
    it('Should Fail - Deposit with Invalid Amount', async function () {
      await expect(
        hectorRedemption
          .connect(registeredWallet)
          .deposit(testWallet3.address, utils.parseEther('0'))
      ).to.be.revertedWith('INVALID_AMOUNT');
    });

    it('Should Fail To Deposit - When lastDayToClaim is over', async function () {
      //increase the time to 1 day
      await increaseTime(86400);

      await expect(
        hectorRedemption
          .connect(registeredWallet)
          .deposit(testWallet3.address, utils.parseEther('1'))
      ).to.be.revertedWith('REDEMPTION_TIME_EXPIRES');
    });
  });

  describe('#Token Vault - Distribute Leftover', async () => {
    before(async function () {
      //Uncomment when running this test case alone
      // await hecToken.mint(testWallet1.address, utils.parseEther('1000'));
      // await hectorRegistration.registerWallet(testWallet1.address);
      // await hecToken
      //   .connect(testWallet1)
      //   .approve(hectorRedemption.address, utils.parseEther('1000'));
      // let tx = await hectorRedemption
      //   .connect(testWallet1)
      //   .deposit(hecToken.address, utils.parseEther('100'));
      // await hecToken.mint(testWallet2.address, utils.parseEther('1000'));
      // await hectorRegistration.registerWallet(testWallet2.address);
      // await hecToken
      //   .connect(testWallet2)
      //   .approve(hectorRedemption.address, utils.parseEther('1000'));
      // let tx2 = await hectorRedemption
      //   .connect(testWallet2)
      //   .deposit(hecToken.address, utils.parseEther('100'));
    });
    it('Should Pass - Distribute all remaining funds to redeemed wallets', async function () {
      //1. Fund the Treasury contract - done
      //get balance of hecToken in treasury contract
      let treasuryBalance = await hecToken.balanceOf(treasury.address);
      //2. Generate test wallets
      const registeredWallets = [];
      const totalWallets: BigNumber = await vaultRNFT.getEligibleWalletsCount();

      for (let i = 0; i < totalWallets.toNumber(); i++) {
        const wallet = await vaultRNFT.getEligibleWalletAtIndex(i);

        const balanceBefore = await hecToken.balanceOf(wallet);

        let nftBalance = await RNFT.balanceOf(wallet);

        //3. Mint NFT
        const redeemAmt: BigNumber = treasuryBalance.div(totalWallets);

        let fnftConfig = {
          eligibleTORAmount: 100,
          eligibleHECAmount: 100,
          redeemableToken: hecToken.address,
          redeemableAmount: redeemAmt,
        };

        let tx = await vaultRNFT.connect(moderator).mint(wallet, fnftConfig);
        nftBalance = await RNFT.balanceOf(wallet);

        const nftId1 = await RNFT.tokenOfOwnerByIndex(
          wallet,
          nftBalance.sub(1)
        );

        //4. Call Withdraw
        let tx2 = await vaultRNFT.withdraw(wallet, nftId1);

        const balanceAfter = await hecToken.balanceOf(wallet);

        expect(await hecToken.balanceOf(wallet)).to.equal(
          balanceBefore.add(redeemAmt)
        );
      }
      treasuryBalance = await hecToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(0);
    });

    it('Should Pass - Use mintWithdraw func to distribute one wallet', async function () {
      //1. Fund the Treasury contract - done
      //get balance of hecToken in treasury contract
      //mint 100 hec to treasury
      await hecToken.mint(treasury.address, utils.parseEther('1000'));
      let treasuryBalance = await hecToken.balanceOf(treasury.address);
      //2. Generate test wallets
      const registeredWallets = [];
      const totalWallets: BigNumber = await vaultRNFT.getEligibleWalletsCount();

      for (let i = 0; i < totalWallets.toNumber(); i++) {
        const wallet = await vaultRNFT.getEligibleWalletAtIndex(i);

        const balanceBefore = await hecToken.balanceOf(wallet);
        let nftBalance = await RNFT.balanceOf(wallet);

        //3. Mint NFT
        const redeemAmt: BigNumber = treasuryBalance.div(totalWallets);
        await vaultRNFT.connect(moderator).addEligibleWallet(wallet, redeemAmt);

        const getEligibleAmt = await vaultRNFT.recipientTokens(wallet);

        let tx = await vaultRNFT.connect(moderator).mintWithdraw(wallet);

        const balanceAfter = await hecToken.balanceOf(wallet);

        expect(await hecToken.balanceOf(wallet)).to.equal(
          balanceBefore.add(getEligibleAmt)
        );
      }
    });
  });

  describe('#Leftover Treasury - Distribute Leftover', async () => {
    before(async function () {});
    it('Should Pass - Deposit', async function () {
      await hecToken.mint(deployer.address, utils.parseEther('1000000'));
      await hecToken.approve(
        leftOverTreasury.address,
        utils.parseEther('1000000')
      );

      await leftOverTreasury.addEligibleWallets([
        testWallet1.address,
        testWallet2.address,
        testWallet3.address,
      ]);
      let tx = await leftOverTreasury.deposit(utils.parseEther('1000000'));

      //check balance after deposit
      expect(await hecToken.balanceOf(leftOverTreasury.address)).to.equal(
        utils.parseEther('1000000')
      );
    });

    it('Should Pass -  WithdrawAll', async function () {
      const _owner = await treasury.owner();
      let balanceBefore = await hecToken.balanceOf(_owner);
      const treasuryBalanceBefore = await hecToken.balanceOf(treasury.address);

      await treasury.withdrawAll();
      let balanceAfter = await hecToken.balanceOf(_owner);
      expect(balanceAfter).to.be.equal(
        balanceBefore.add(treasuryBalanceBefore)
      );

      await hecToken.mint(deployer.address, utils.parseEther('1000000'));
      await hecToken.approve(
        leftOverTreasury.address,
        utils.parseEther('1000000')
      );

      await leftOverTreasury.deposit(utils.parseEther('1000000'));
    });
    it('Should Pass -  Distribute Leftover to authorized Wallet', async function () {
      //get balance of testWallet1
      const balanceBefore = await hecToken.balanceOf(testWallet1.address);
      //get balance of treasury
      const treasuryBalance = await hecToken.balanceOf(
        leftOverTreasury.address
      );
      const amountPerWallet = await leftOverTreasury.amountPerWallet();

      //distribute
      const tx = await leftOverTreasury.distributeLeftOverToWallet(
        testWallet1.address
      );

      await expect(tx)
        .to.emit(leftOverTreasury, 'LeftOverDistributed')
        .withArgs(testWallet1.address, amountPerWallet);

      //check balance after distribution
      const balanceAfter = await hecToken.balanceOf(testWallet1.address);
      expect(balanceAfter).to.be.equal(balanceBefore.add(amountPerWallet));
    });

    it('Should Fail -  Distribute Leftover to Unauthorized Wallet', async function () {
      await expect(
        leftOverTreasury.distributeLeftOverToWallet(unRegisterWallet.address)
      ).to.be.revertedWith('UNAUTHORIZED_RECIPIENT');
    });

    it('Should Fail -  Distribute Leftover to Blacklist Wallet', async function () {
      await leftOverTreasury.addEligibleWallet(testWallet2.address);
      const totalBlacklistedWalletsBefore =
        await leftOverTreasury.getBlacklistCount();
      await leftOverTreasury.addBlacklistWallets([testWallet2.address]);

      expect(await leftOverTreasury.getBlacklistCount()).to.equal(
        totalBlacklistedWalletsBefore.add(1)
      );
      await expect(
        leftOverTreasury.distributeLeftOverToWallet(testWallet2.address)
      ).to.be.revertedWith('BLACKLISTED_RECIPIENT');

      //remove blacklist wallet
      await leftOverTreasury.removeBlacklistWallet([testWallet2.address]);
    });
    it('Should Fail -  Already received leftover', async function () {
      await expect(
        leftOverTreasury.distributeLeftOverToWallet(testWallet1.address)
      ).to.be.revertedWith('WALLET_ALREADY_RECEIVED_LEFTOVER');
    });
    it('Should Pass -  Distribute Leftover to many Wallets', async function () {
      //get balance of testWallet1
      const balanceBeforeWallet2 = await hecToken.balanceOf(
        testWallet2.address
      );
      const balanceBeforeWallet3 = await hecToken.balanceOf(
        testWallet3.address
      );
      //get balance of treasury
      const treasuryBalance = await hecToken.balanceOf(
        leftOverTreasury.address
      );
      const amountPerWallet = await leftOverTreasury.amountPerWallet();

      const wallets = [testWallet2.address, testWallet3.address];

      //distribute
      const tx = await leftOverTreasury.distributeLeftOverToWallets(wallets);

      const balanceAfterWallet2 = await hecToken.balanceOf(testWallet2.address);

      const balanceAfterWallet3 = await hecToken.balanceOf(testWallet3.address);

      await expect(balanceAfterWallet2).to.be.equal(
        balanceBeforeWallet2.add(amountPerWallet)
      );

      await expect(balanceAfterWallet3).to.be.equal(
        balanceBeforeWallet3.add(amountPerWallet)
      );
    });
  });

  describe('#Uniswap - add/remove liquidity', async () => {
    it('Should Pass - addLiquidity', async function () {
      const hecDecimals = await hecToken.decimals();
      const torDecimals = await torToken.decimals();
      const torHECDecimals = await torHEC.decimals();

      const amountTokenDesired1 = utils
        .parseEther('10')
        .div(BigNumber.from(10).pow(hecDecimals));
      const amountTokenDesired2 = utils
        .parseEther('5')
        .div(BigNumber.from(10).pow(torDecimals >= 18 ? 0 : torDecimals));

      await hecToken.mint(deployer.address, amountTokenDesired1);
      await torToken.mint(deployer.address, amountTokenDesired2);

      await hecToken.approve(uniswapV2Router.address, utils.parseEther('10'));
      await torToken.approve(uniswapV2Router.address, utils.parseEther('10'));

      const torBalanceBefore = await torToken.balanceOf(deployer.address);
      const hecBalanceBefore = await hecToken.balanceOf(deployer.address);
      const torHecBalanceBefore = await torHEC.balanceOf(deployer.address);

      const tx = await uniswapV2Router.addLiquidity(
        hecToken.address,
        torToken.address,
        torHEC.address,
        amountTokenDesired1,
        amountTokenDesired2,
        deployer.address
      );

      const torBalanceAfter = await torToken.balanceOf(deployer.address);
      const hecBalanceAfter = await hecToken.balanceOf(deployer.address);
      const torHecBalanceAfter = await torHEC.balanceOf(deployer.address);

      expect(torBalanceAfter).to.be.equal(
        torBalanceBefore.sub(amountTokenDesired2)
      );
      expect(hecBalanceAfter).to.be.equal(
        hecBalanceBefore.sub(amountTokenDesired1)
      );
    });

    it('Should Pass - removeLiquidity', async function () {
      const hecDecimals = await hecToken.decimals();
      const torDecimals = await torToken.decimals();
      const torHECDecimals = await torHEC.decimals();
      const torHecBalance = await torHEC.balanceOf(deployer.address);

      const torBalanceBefore = await torToken.balanceOf(deployer.address);
      const hecBalanceBefore = await hecToken.balanceOf(deployer.address);
      const torHecBalanceBefore = await torHEC.balanceOf(deployer.address);

      await torHEC.approve(uniswapV2Router.address, utils.parseEther('100000'));

      const tx = await uniswapV2Router.removeLiquidity(
        hecToken.address,
        torToken.address,
        torHEC.address,
        torHecBalance,
        deployer.address
      );

      const torBalanceAfter = await torToken.balanceOf(deployer.address);
      const hecBalanceAfter = await hecToken.balanceOf(deployer.address);
      const torHecBalanceAfter = await torHEC.balanceOf(deployer.address);

      expect(torHecBalanceAfter).to.be.equal(0);
    });
  });
});
