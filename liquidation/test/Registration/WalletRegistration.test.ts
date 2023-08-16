import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp, waitSeconds } from '../../helper';
import { HectorRegistration } from '../../types';

describe('Hector Registration', function () {
  let deployer: SignerWithAddress;
  let multisig: SignerWithAddress;
  let moderator: SignerWithAddress;
  let registeredWallet: SignerWithAddress;
  let testWallet1: SignerWithAddress,
    testWallet2: SignerWithAddress,
    testWallet3: SignerWithAddress;

  let hectorRegistration: HectorRegistration;

  before(async function () {
    [
      deployer,
      multisig,
      moderator,
      registeredWallet,
      testWallet1,
      testWallet2,
      testWallet3,
    ] = await ethers.getSigners();

    const HectorRegistrationFactory = await ethers.getContractFactory(
      'HectorRegistration'
    );
    hectorRegistration = (await HectorRegistrationFactory.deploy(
      multisig.address,
      moderator.address
    )) as HectorRegistration;
  });

  describe('#Wallet Registration', async () => {
    it('Should Pass - Register Wallet (Only Moderator)', async function () {
      const txQueue = await hectorRegistration.registerWallet(
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
    it('Should Not Pass - Duplicated Wallet', async function () {
      await expect(
        hectorRegistration.registerWallet(registeredWallet.address)
      ).to.be.revertedWith('INVALID_WALLET');
    });
    it('Should Not Pass - Wallet is Blacklisted', async function () {
      const tx = await hectorRegistration.addBlacklistWallet([
        testWallet2.address,
      ]);
      await expect(
        hectorRegistration.registerWallet(testWallet2.address)
      ).to.be.revertedWith('INVALID_WALLET');
    });
    it('Should Not Pass - Unauthorized Access (Not Moderator)', async function () {
      await expect(
        hectorRegistration
          .connect(testWallet2)
          .registerWallet(registeredWallet.address)
      ).to.be.reverted;
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
