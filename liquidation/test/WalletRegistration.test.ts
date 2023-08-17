import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp, waitSeconds } from '../../helper';
import { HectorRegistration, RewardToken, HectorFNFT } from '../../types';

describe('Hector Registration', function () {
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

  let FNFT: HectorFNFT;

  let hectorRegistration: HectorRegistration;
  let walletAddresses: [];
  let totalWallets: number;

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

    const FNFTFactory = await ethers.getContractFactory('HectorFNFT');
    FNFT = (await FNFTFactory.deploy()) as HectorFNFT;

    let eligibleTokens = [hecToken.address, wsHec.address, sHec.address];

    const HectorRegistrationFactory = await ethers.getContractFactory(
      'HectorRegistration'
    );
    hectorRegistration = (await HectorRegistrationFactory.deploy(
      multisig.address,
      moderator.address,
      eligibleTokens,
      FNFT.address
    )) as HectorRegistration;

    //generate 20 wallet addresses to an array
    walletAddresses = [];
    totalWallets = 20;

    for (let i = 0; i < totalWallets; i++) {
      const wallet = ethers.Wallet.createRandom();
      walletAddresses.push(wallet.address);
      //mint tokens to the wallet
      await hecToken.mint(wallet.address, utils.parseEther('1000000'));
    }
  });

  describe('#Wallet Registration', async () => {
    // it('Should Pass - Register 10k Wallets (Only Moderator)', async function () {
    //   const chunkSize = 25;
    //   const chunks = Math.ceil(totalWallets / chunkSize);

    //   for (let i = 0; i < chunks; i++) {
    //     let chunkWallets = walletAddresses.slice(
    //       i * chunkSize,
    //       (i + 1) * chunkSize
    //     );

    //     const txQueue = await hectorRegistration.registerWallets(chunkWallets);
    //     txQueue.wait(10);
    //   }

    //   const walletCount = await hectorRegistration.getRegisteredWalletsCount();
    //   expect(walletCount).to.be.equal(totalWallets);
    // });
    it('Should Not Pass - Wallet balances are zero', async function () {
      await expect(
        hectorRegistration.registerWallet(registeredWallet.address)
      ).to.be.revertedWith('INVALID_BALANCE');
    });
    it('Should Not Pass - Wallet has unregistered tokens', async function () {
      await unregisteredToken.mint(
        deployer.address,
        utils.parseEther('100000000')
      );
      await expect(
        hectorRegistration.registerWallet(registeredWallet.address)
      ).to.be.revertedWith('INVALID_BALANCE');
    });
    it('Should Pass - Register Wallet with FNFT', async function () {
      await FNFT.mint(registeredWallet.address);
      let txQueue = await hectorRegistration.registerWallet(
        registeredWallet.address
      );

      await expect(txQueue)
        .to.emit(hectorRegistration, 'AddRegisteredWallet')
        .withArgs(registeredWallet.address);

      const isAvailable = await hectorRegistration.isRegisteredWallet(
        registeredWallet.address
      );

      expect(isAvailable).to.be.true;
    });
    it('Should Pass - Register Wallet', async function () {
      const registeredWalletBalance = await hecToken.balanceOf(
        testWallet3.address
      );
      if (registeredWalletBalance.eq(0))
        await hecToken.mint(testWallet3.address, utils.parseEther('1000000'));

      const txQueue = await hectorRegistration.registerWallet(
        testWallet3.address
      );

      await expect(txQueue)
        .to.emit(hectorRegistration, 'AddRegisteredWallet')
        .withArgs(testWallet3.address);

      const isAvailable = await hectorRegistration.isRegisteredWallet(
        testWallet3.address
      );

      expect(isAvailable).to.be.true;
    });
    it('Should Pass - Register Many Wallets', async function () {
      const prevCount = await hectorRegistration.getRegisteredWalletsCount();

      const txQueue = await hectorRegistration.registerWallets(walletAddresses);

      const isAvailable = await hectorRegistration.isRegisteredWallet(
        registeredWallet.address
      );

      expect(isAvailable).to.be.true;

      const walletCount = await hectorRegistration.getRegisteredWalletsCount();
      expect(walletCount).to.be.equal(prevCount.add(totalWallets));
    });

    it('Should Pass - Get first 5 wallets', async function () {
      const wallets = await hectorRegistration.getWalletsFromRange(0, 5);
      expect(wallets.length).to.be.equal(5);
    });

    it('Should Fail - Invalid range', async function () {
      await expect(
        hectorRegistration.getWalletsFromRange(21, 5)
      ).to.be.revertedWith('INVALID_PARAM');

      await expect(
        hectorRegistration.getWalletsFromRange(0, 23)
      ).to.be.revertedWith('INVALID_PARAM');

      await expect(
        hectorRegistration.getWalletsFromRange(0, 0)
      ).to.be.revertedWith('INVALID_PARAM');

      await expect(
        hectorRegistration.getWalletsFromRange(5, 5)
      ).to.be.revertedWith('INVALID_PARAM');
    });

    it('Should Fail - Duplicated Wallet', async function () {
      await expect(
        hectorRegistration.registerWallet(registeredWallet.address)
      ).to.be.revertedWith('INVALID_WALLET');
    });
    it('Should Fail - Wallet is Blacklisted', async function () {
      const tx = await hectorRegistration.addBlacklistWallet([
        testWallet2.address,
      ]);
      await expect(
        hectorRegistration.registerWallet(testWallet2.address)
      ).to.be.revertedWith('INVALID_WALLET');
    });
  });

  describe('#Test Blacklist Wallets', async () => {
    it('Should Pass - Delete If Exists', async function () {
      const isAvailable = await hectorRegistration.isBlacklistedWallet(
        testWallet2.address
      );

      if (isAvailable) {
        //Verify the acount
        let totalBlacklist = await hectorRegistration.getBlacklistCount();
        expect(totalBlacklist).to.be.equal(1);

        const txQueue = await hectorRegistration.removeBlacklistWallet([
          testWallet2.address,
        ]);
        await expect(txQueue)
          .to.emit(hectorRegistration, 'RemoveBlacklistedWallet')
          .withArgs(testWallet2.address);

        totalBlacklist = await hectorRegistration.getBlacklistCount();
        expect(totalBlacklist).to.be.equal(0);
      }
    });

    it('Should Pass - Add blacklist Wallet (Only Moderator)', async function () {
      const txQueue = await hectorRegistration.addBlacklistWallet([
        testWallet2.address,
      ]);

      await expect(txQueue)
        .to.emit(hectorRegistration, 'AddBlacklistedWallet')
        .withArgs(testWallet2.address);
    });

    it('Should Not Pass - Duplicated Wallet', async function () {
      await expect(
        hectorRegistration.addBlacklistWallet([testWallet2.address])
      ).to.be.revertedWith('INVALID_WALLET');
    });

    it('Should Pass - Remove blacklist Wallet (Only Moderator)', async function () {
      const txQueue = await hectorRegistration.removeBlacklistWallet([
        testWallet2.address,
      ]);

      await expect(txQueue)
        .to.emit(hectorRegistration, 'RemoveBlacklistedWallet')
        .withArgs(testWallet2.address);
    });

    it('Should Not Pass - Wallet is Not Available', async function () {
      await expect(
        hectorRegistration.removeBlacklistWallet([testWallet2.address])
      ).to.be.revertedWith('INVALID_WALLET');
    });
    it('Should Not Pass - Unauthorized Add Blacklist (Not Moderator)', async function () {
      await expect(
        hectorRegistration
          .connect(testWallet3)
          .addBlacklistWallet([testWallet2.address])
      ).to.be.reverted;
    });
    it('Should Not Pass - Unauthorized Remove Blacklist (Not Moderator)', async function () {
      await expect(
        hectorRegistration
          .connect(testWallet3)
          .removeBlacklistWallet([testWallet2.address])
      ).to.be.reverted;
    });
  });
});
