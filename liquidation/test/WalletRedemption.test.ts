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
  RewardToken,
  FNFT,
  LockAccessControl,
  LockAddressRegistry,
} from '../../types';

describe('Hector Redemption', function () {
  let deployer: SignerWithAddress;
  let multisig: SignerWithAddress;
  let moderator: SignerWithAddress;
  let registeredWallet: SignerWithAddress;
  let testWallet1: SignerWithAddress,
    testWallet2: SignerWithAddress,
    testWallet3: SignerWithAddress;

  let hecToken: RewardToken,
    wsHec: RewardToken,
    sHec: RewardToken,
    unregisteredToken: RewardToken;

  let FNFT: FNFT;
  let RNFT: FNFT;

  let hectorRegistration: HectorRegistration;
  let hectorRedemption: HectorRedemption;
  let treasury: HectorRedemptionTreasury;
  let vaultFNFT: TokenVault; //For previous FNFT Vault
  let vaultRNFT: TokenVault; //New RNFT Receipt
  let walletAddresses: [];
  let totalWallets: number;

  let lockAccess: LockAccessControl;
  let lockAddressRegistry: LockAddressRegistry;

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
    ] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory('RewardToken');
    hecToken = (await TokenFactory.deploy()) as RewardToken;
    wsHec = (await TokenFactory.deploy()) as RewardToken;
    sHec = (await TokenFactory.deploy()) as RewardToken;
    unregisteredToken = (await TokenFactory.deploy()) as RewardToken;

    let eligibleTokens = [hecToken.address, wsHec.address, sHec.address];

    const lockAccessRegistryFactory = await ethers.getContractFactory(
      'LockAddressRegistry'
    );
    lockAddressRegistry =
      (await lockAccessRegistryFactory.deploy()) as LockAddressRegistry;

    const FNFTFactory = await ethers.getContractFactory('FNFT');
    FNFT = (await FNFTFactory.deploy(lockAddressRegistry.address)) as FNFT;
    RNFT = (await FNFTFactory.deploy(lockAddressRegistry.address)) as FNFT;

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
      lastDayToClaim
    )) as HectorRedemption;

    //Deploy Treasury
    const HectorTreasuryFactory = await ethers.getContractFactory(
      'HectorRedemptionTreasury'
    );

    treasury = (await HectorTreasuryFactory.deploy(
      lockAddressRegistry.address
    )) as HectorRedemptionTreasury;

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

    for (let i = 0; i < totalWallets; i++) {
      const wallet = ethers.Wallet.createRandom();
      walletAddresses.push(wallet.address);
      //mint tokens to the wallet
      await hecToken.mint(wallet.address, utils.parseEther('1000000'));
    }

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
      ).to.be.revertedWith('INVALID_AMOUNT');
    });
    // it('Should Pass - Test Withdraw', async function () {
    //   let balanceBefore = await hecToken.balanceOf(multisig.address);
    //   let tx = await treasury.withdrawAll();
    //   let balanceAfter = await hecToken.balanceOf(multisig.address);

    //   expect(balanceAfter).to.be.equal(
    //     balanceBefore.add(utils.parseEther('1000000'))
    //   );
    // });
  });

  describe('#Token Vault', async () => {
    it('Should Pass - Mint', async function () {
      const fnftConfig = {
        eligibleTORAmount: 100,
        eligibleHECAmount: 100,
        redeemableToken: hecToken.address,
        redeemableAmount: utils.parseEther('10'),
      };

      let tx = await vaultRNFT
        .connect(moderator)
        .mint(registeredWallet.address, fnftConfig);

      await expect(tx)
        .to.emit(vaultRNFT, 'RedeemNFTMinted')
        .withArgs(
          registeredWallet.address,
          1,
          fnftConfig.eligibleTORAmount,
          fnftConfig.eligibleHECAmount,
          fnftConfig.redeemableAmount
        );

      expect(await RNFT.balanceOf(registeredWallet.address)).to.equal('2');
    });
    it('Should Fail - Mint Fails with Zero Amount', async function () {
      let fnftConfig = {
        eligibleTORAmount: utils.parseEther('0'),
        eligibleHECAmount: utils.parseEther('0'),
        redeemableToken: hecToken.address,
        redeemableAmount: utils.parseEther('0'),
      };

      await expect(
        vaultRNFT.connect(moderator).mint(registeredWallet.address, fnftConfig)
      ).to.be.revertedWith('INVALID_AMOUNT');
    });
    it('Should Pass - Withdraw', async function () {
      let tx = await vaultRNFT.withdraw(registeredWallet.address, 1);

      await expect(tx)
        .to.emit(vaultRNFT, 'RedeemNFTWithdrawn')
        .withArgs(registeredWallet.address, 1, utils.parseEther('10'));

      expect(await RNFT.balanceOf(registeredWallet.address)).to.equal('1');

      expect(await hecToken.balanceOf(registeredWallet.address)).to.equal(
        utils.parseEther('1010')
      );
    });
    it('Should Fail - Unable to Withdraw due to invalid receipt', async function () {
      await expect(
        vaultRNFT.withdraw(testWallet1.address, 0)
      ).to.be.revertedWith('INVALID_RECIPIENT');
    });
    it('Should Fail - Unable to Withdraw - Receipt Not Found', async function () {
      await expect(
        vaultRNFT.withdraw(registeredWallet.address, 0)
      ).to.be.revertedWith('INVALID_ADDRESS');
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

      expect(await hectorRedemption.getRedeemedWalletsCount()).to.equal('1');
    });

    it('Should Pass - Deposit NFT', async function () {
      await RNFT.mint(testWallet2.address);
      const nftId1 = await RNFT.tokenOfOwnerByIndex(testWallet2.address, 0);

      await RNFT.mint(testWallet2.address);
      const nftId2 = await RNFT.tokenOfOwnerByIndex(testWallet2.address, 1);

      await RNFT.mint(testWallet2.address);
      const nftId3 = await RNFT.tokenOfOwnerByIndex(testWallet2.address, 2);

      await hectorRegistration.registerWallet(testWallet2.address);

      await RNFT.connect(testWallet2).approve(hectorRedemption.address, nftId1);

      await RNFT.connect(testWallet2).approve(hectorRedemption.address, nftId3);

      let tx = await hectorRedemption
        .connect(testWallet2)
        .depositFNFTs([nftId1, nftId3]);

      expect(await hectorRedemption.getRedeemedWalletsCount()).to.equal('2');

      //check matching deposit wallets
      expect(
        await hectorRedemption.isRedeemedWallet(testWallet2.address)
      ).to.equal(true);

      expect(await hectorRedemption.getRedeemedWalletAtIndex(1)).to.equal(
        testWallet2.address
      );

      //Check if the NFTs are transferred to the vault
      expect(await RNFT.balanceOf(testWallet2.address)).to.equal('1');

      //check nft balance on hector redemption
      expect(await RNFT.balanceOf(hectorRedemption.address)).to.equal('2');
    });

    it('Failed Deposit NFT Tx when paused', async function () {
      const txPause = await hectorRedemption.pause();

      await expect(
        hectorRedemption.connect(testWallet1).depositFNFTs([5])
      ).to.be.revertedWith('Pausable: paused');
    });

    it('Success Deposit NFT Tx when unpaused', async function () {
      const txPause = await hectorRedemption.unpause();

      await RNFT.mint(testWallet2.address);
      const nftId1 = await RNFT.tokenOfOwnerByIndex(testWallet2.address, 0);

      await RNFT.connect(testWallet2).approve(hectorRedemption.address, nftId1);

      let tx = await hectorRedemption
        .connect(testWallet2)
        .depositFNFTs([nftId1]);

      await expect(tx)
        .to.emit(hectorRedemption, 'DepositFNFT')
        .withArgs(nftId1);
    });

    it('Should Pass - Burn Tokens', async function () {
      const beforeBalance = await hecToken.balanceOf(hectorRedemption.address);
      let tx = await hectorRedemption.burnTokens();

      const afterBalance = await hecToken.balanceOf(hectorRedemption.address);
      expect(afterBalance).to.be.equal(0);
    });
    it('Should Pass - Burn NFTs', async function () {
      const beforeBalance = await RNFT.balanceOf(hectorRedemption.address);
      let tx = await hectorRedemption.burnFNFTs();

      const afterBalance = await RNFT.balanceOf(hectorRedemption.address);
      expect(afterBalance).to.be.equal(0);
    });
    it('Should Fail - Deposit with Invalid Wallet', async function () {
      await expect(
        hectorRedemption
          .connect(registeredWallet)
          .deposit(hecToken.address, utils.parseEther('100'))
      ).to.be.revertedWith('INVALID_WALLET');
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
    it('Should Fail - Deposit NFT with Invalid Owner', async function () {
      await expect(
        hectorRedemption.connect(testWallet3).depositFNFTs([0, 1])
      ).to.be.revertedWith('INVALID_WALLET');
    });

    it('Should Fail To Deposit - When lastDayToClaim is over', async function () {
      //increase the time to 1 day
      await increaseTime(86400);

      await expect(
        hectorRedemption
          .connect(registeredWallet)
          .deposit(testWallet3.address, utils.parseEther('1'))
      ).to.be.revertedWith('REDEMPTION_TIME_EXPIRES');

      await expect(
        hectorRedemption.connect(testWallet3).depositFNFTs([0, 1])
      ).to.be.revertedWith('REDEMPTION_TIME_EXPIRES');
    });
  });

  describe('#Token Vault - Distribute Leftover', async () => {
    it('Should Pass - Distribute all remaining funds to redeemed wallets', async function () {
      //1. Fund the Treasury contract - done
      //get balance of hecToken in treasury contract
      let treasuryBalance = await hecToken.balanceOf(treasury.address);
      //2. Generate test wallets
      const registeredWallets = [];
      const totalWallets: BigNumber =
        await hectorRedemption.getRedeemedWalletsCount();

      for (let i = 0; i < totalWallets.toNumber(); i++) {
        const wallet = await hectorRedemption.getRedeemedWalletAtIndex(i);

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

        //update leftover list
        await hectorRedemption.addLeftOverWallet(wallet);
      }
      treasuryBalance = await hecToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(0);
    });

    it('Should Pass - Unable to Add duplicated leftover wallet', async function () {
      const leftOverWalletCount =
        await hectorRedemption.getLeftOverWalletsCount();

      //update leftover list
      await hectorRedemption.addLeftOverWallet(testWallet1.address);

      expect(await hectorRedemption.getLeftOverWalletsCount()).to.equal(
        leftOverWalletCount
      );
    });
    it('Should Pass - Remove Leftover wallet', async function () {
      const leftOverWalletCount =
        await hectorRedemption.getLeftOverWalletsCount();

      //update leftover list
      await hectorRedemption.removeLeftOverWallet(testWallet1.address);

      const leftOverWalletCountPost =
        await hectorRedemption.getLeftOverWalletsCount();

      expect(await hectorRedemption.getLeftOverWalletsCount()).to.equal(
        leftOverWalletCount.sub(1)
      );
    });
    it('Should Pass - Use mintWithdraw func to distribute one wallet', async function () {
      //1. Fund the Treasury contract - done
      //get balance of hecToken in treasury contract
      //mint 100 hec to treasury
      await hecToken.mint(treasury.address, utils.parseEther('100'));
      let treasuryBalance = await hecToken.balanceOf(treasury.address);
      //2. Generate test wallets
      const registeredWallets = [];
      const totalWallets: BigNumber =
        await hectorRedemption.getRedeemedWalletsCount();

      for (let i = 0; i < totalWallets.toNumber(); i++) {
        const wallet = await hectorRedemption.getRedeemedWalletAtIndex(i);

        const balanceBefore = await hecToken.balanceOf(wallet);
        let nftBalance = await RNFT.balanceOf(wallet);

        //3. Mint NFT
        const redeemAmt: BigNumber = treasuryBalance.div(totalWallets);

        let tx = await vaultRNFT
          .connect(moderator)
          .mintWithdraw(wallet, redeemAmt);

        const balanceAfter = await hecToken.balanceOf(wallet);

        expect(await hecToken.balanceOf(wallet)).to.equal(
          balanceBefore.add(redeemAmt)
        );

        //update leftover list
        await hectorRedemption.addLeftOverWallet(wallet);
      }
      treasuryBalance = await hecToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(0);
    });
    it('Should Pass - Use mintWithdraw func to distribute many wallets', async function () {
      //1. Fund the Treasury contract - done
      //get balance of hecToken in treasury contract
      //mint 100 hec to treasury
      await hecToken.mint(treasury.address, utils.parseEther('100'));
      let treasuryBalance = await hecToken.balanceOf(treasury.address);
      //2. Generate test wallets
      const registeredWallets = [];
      const totalWallets: BigNumber =
        await hectorRedemption.getRedeemedWalletsCount();

      const redeemAmt: BigNumber = treasuryBalance.div(totalWallets);
      const wallets = await hectorRedemption.getAllRedeemedWallets();
      let redeemAmts = [];
      for (let i = 0; i < totalWallets.toNumber(); i++) {
        redeemAmts.push(redeemAmt);
      }

      let tx = await vaultRNFT
        .connect(moderator)
        .mintWithdraws(wallets, redeemAmts);

      for (let i = 0; i < totalWallets.toNumber(); i++) {
        const wallet = await hectorRedemption.getRedeemedWalletAtIndex(i);

        //update leftover list
        await hectorRedemption.addLeftOverWallet(wallet);
      }
      treasuryBalance = await hecToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(0);
    });
  });
});
