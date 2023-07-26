import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp, waitSeconds } from '../helper';
import { HecBridgeSplitter } from '../types';
import tempStepDataForSquid from '../scripts/test/tempStepDataForSquid.json';
import erc20Abi from '../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json';

describe('Hector Bridge', function () {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let token: SignerWithAddress;

  let lifiBridge: string = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
  let squidRouter: string = '0xce16f69375520ab01377ce7b88f5ba8c48f8d666';
  let dao: string = '0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90';
  let feePercentage: number = 950;
  let countDest: number = 2;
  let blocksNeededForQueue = 5; // 8 hours
  let ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  enum MANAGING {
    RESERVE_BRIDGES,
    RESERVE_BRIDGE_ASSETS,
  }

  let hectorBridge: HecBridgeSplitter;

  before(async function () {
    [deployer, alice, token] = await ethers.getSigners();

    const HectorBridge = await ethers.getContractFactory('HecBridgeSplitter');
    hectorBridge = (await upgrades.deployProxy(
      HectorBridge,
      [countDest, blocksNeededForQueue, dao],
      {
        initializer: 'initialize',
      }
    )) as HecBridgeSplitter;
  });

  describe('#Test Bridge Whitelisting', async () => {
    it('Queue up request', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGES,
        lifiBridge
      );
      let txReceipt = await hectorBridge.provider.getTransactionReceipt(
        txQueue.hash
      );

      await expect(txQueue)
        .to.emit(hectorBridge, 'ChangeQueued')
        .withArgs(MANAGING.RESERVE_BRIDGES, lifiBridge);
    });

    it('Queue Many request', async function () {
      const txQueue = await hectorBridge.queueMany(MANAGING.RESERVE_BRIDGES, [
        lifiBridge,
        alice.address,
      ]);

      expect(
        (await hectorBridge.reserveBridgeQueue(lifiBridge)).toNumber()
      ).to.be.greaterThan(0);

      expect(
        (await hectorBridge.reserveBridgeQueue(alice.address)).toNumber()
      ).to.be.greaterThan(0);
    });

    it('Should Fail: update values before queue time is over', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGES,
        lifiBridge
      );

      await expect(
        hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge)
      ).to.be.revertedWith('QUEUE_NOT_EXPIRED');
    });

    it('Should Pass - Wait For Queue to be over', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGES,
        lifiBridge
      );

      await expect(txQueue)
        .to.emit(hectorBridge, 'ChangeQueued')
        .withArgs(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      const txToogle = await hectorBridge.toggle(
        MANAGING.RESERVE_BRIDGES,
        lifiBridge
      );

      await expect(txToogle)
        .to.emit(hectorBridge, 'ChangeActivated')
        .withArgs(MANAGING.RESERVE_BRIDGES, lifiBridge, true);
    });
    it('Should Pass - Toggle off when duplicated bridge contract', async function () {
      const origianlStatus = await hectorBridge.isReservedBridge(lifiBridge);
      if (origianlStatus) await hectorBridge.removeReserveBridge(lifiBridge);

      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);

      //check if bridge exists
      expect(await hectorBridge.isReservedBridge(lifiBridge)).equal(true);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);
      await increaseTime(blocksNeededForQueue + 5);
      const tx = await hectorBridge.toggle(
        MANAGING.RESERVE_BRIDGES,
        lifiBridge
      );

      expect(
        await hectorBridge.isReservedBridge(lifiBridge)
      ).equal(false);
    });
    it('Should Pass - Delete bridge contract', async function () {
      const origianlStatus = await hectorBridge.isReservedBridge(lifiBridge);
      if (origianlStatus) await hectorBridge.removeReserveBridge(lifiBridge);

      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);

      //check if bridge exists
      expect(await hectorBridge.isReservedBridge(lifiBridge)).equal(true);

      const tx = await hectorBridge.removeReserveBridge(lifiBridge);
      expect(
        await hectorBridge.isReservedBridge(lifiBridge)
      ).equal(false)
    });

    it('Should Pass - Update bridge contract', async function () {
      const origianlStatus = await hectorBridge.isReservedBridge(lifiBridge);
      if (origianlStatus) await hectorBridge.removeReserveBridge(lifiBridge);

      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);

      //Delete
      await hectorBridge.removeReserveBridge(lifiBridge);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, alice.address);
      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, alice.address);

      expect(await hectorBridge.isReservedBridge(alice.address)).equal(true);
    });

    it('isReserveBridge to false after removing', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);
      await hectorBridge.removeReserveBridge(lifiBridge);

      expect(await hectorBridge.isReservedBridge(lifiBridge)).equal(false);
    });
    it('Should Pass - Add many bridge contracts', async function () {
      const txQueue = await hectorBridge.queueMany(MANAGING.RESERVE_BRIDGES, [
        lifiBridge,
        token.address,
      ]);

      await increaseTime(blocksNeededForQueue + 5);
      const txToogle = await hectorBridge.toggleMany(MANAGING.RESERVE_BRIDGES, [
        lifiBridge,
        token.address,
      ]);

      expect(await hectorBridge.getReserveBridgesCount()).equal(3);
    });
  });

  describe('#Test Bridge Assets Whitelisting', async () => {
    it('Queue up request', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        token.address
      );

      await expect(txQueue)
        .to.emit(hectorBridge, 'ChangeQueued')
        .withArgs(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);
    });

    it('Queue Many request', async function () {
      const txQueue = await hectorBridge.queueMany(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        [lifiBridge, alice.address]
      );

      expect(
        (await hectorBridge.reserveBridgeAssetQueue(lifiBridge)).toNumber()
      ).to.be.greaterThan(0);

      expect(
        (await hectorBridge.reserveBridgeAssetQueue(alice.address)).toNumber()
      ).to.be.greaterThan(0);
    });

    it('Should Fail: update values before queue time is over', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        token.address
      );

      await expect(
        hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address)
      ).to.be.revertedWith('QUEUE_NOT_EXPIRED');
    });

    it('Should Pass - Wait For Queue to be over', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        token.address
      );

      await expect(txQueue)
        .to.emit(hectorBridge, 'ChangeQueued')
        .withArgs(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      const txToogle = await hectorBridge.toggle(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        token.address
      );

      await expect(txToogle)
        .to.emit(hectorBridge, 'ChangeActivated')
        .withArgs(MANAGING.RESERVE_BRIDGE_ASSETS, token.address, true);
    });

    it('Should Pass - Toogle off add duplicated bridge asset', async function () {
      const origianlStatus = await hectorBridge.isReservedAsset(token.address);
      if (origianlStatus) await hectorBridge.removeReserveBridgeAsset(token.address);
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      //check if bridge exists
      expect(await hectorBridge.isReservedAsset(token.address)).equal(true);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);
      await increaseTime(blocksNeededForQueue + 5);
      const tx = await hectorBridge.toggle(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        token.address
      );

      expect(
        await hectorBridge.isReservedAsset(token.address)
      ).equal(false);
    });

    it('Should Pass - Delete bridge asset', async function () {
      const origianlStatus = await hectorBridge.isReservedAsset(token.address);
      if (origianlStatus) await hectorBridge.removeReserveBridgeAsset(token.address);

      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      //check if bridge exists
      expect(await hectorBridge.isReservedAsset(token.address)).equal(true);

      const tx = await hectorBridge.removeReserveBridgeAsset(token.address);
      expect(
        await hectorBridge.isReservedAsset(token.address)
      ).equal(false);
    });
    it('Should Pass - Update bridge asset', async function () {
      const origianlStatus = await hectorBridge.isReservedAsset(token.address);
      if (origianlStatus) await hectorBridge.removeReserveBridgeAsset(token.address);

      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      //Delete
      await hectorBridge.removeReserveBridgeAsset(token.address);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, alice.address);
      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, alice.address);

      expect(
        await hectorBridge.isReservedAsset(alice.address)
      ).equal(true);
    });

    it('isReserveBridgeAsset to true after adding asset', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);
      expect(
        await hectorBridge.isReservedAsset(token.address)
      ).equal(true);
    });

    it('isReserveBridgeAsset to false after removing asset', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);
      await hectorBridge.removeReserveBridgeAsset(token.address);

      expect(
        await hectorBridge.isReservedAsset(token.address)
      ).equal(false);
    });

    it('Should Pass - Add many bridge tokens', async function () {
      const txQueue = await hectorBridge.queueMany(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        [lifiBridge, token.address]
      );

      await increaseTime(blocksNeededForQueue + 5);
      const txToogle = await hectorBridge.toggleMany(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        [lifiBridge, token.address]
      );

      expect(await hectorBridge.getReserveBridgeAssetsCount()).equal(3);
    });
  });

  describe('#Test DAO set', async () => {
    it('Unable to set DAO if not owner', async function () {
      await expect(hectorBridge.connect(alice).setDAO(dao)).to.be.reverted
    });

    it('Unable to add zero address', async function () {
      await expect(hectorBridge.connect(deployer).setDAO(ZERO_ADDRESS)).to.be
        .reverted;
    });

    it('Compare DAO after adding', async function () {
      const result = await hectorBridge.connect(deployer).setDAO(dao);
      await result.wait();
      await waitSeconds(3);
      expect(await hectorBridge.connect(deployer).DAO()).equal(dao);
    });
  });

  describe('#Test Minimum Fee Percentage Configuration', async () => {
    it('Unable to set Fee if not owner', async function () {
      await expect(
        hectorBridge.connect(alice).setMinFeePercentage(feePercentage)
      ).to.be.reverted
    });

    it('Compare FeePercentage after adding', async function () {
      const result = await hectorBridge
        .connect(deployer)
        .setMinFeePercentage(feePercentage);
      await result.wait();
      await waitSeconds(3);
      expect(await hectorBridge.connect(deployer).minFeePercentage()).equal(
        feePercentage
      );
    });
  });

  describe('#Test Count Destination Configuration', async () => {
    it('Unable to set Fee if not owner', async function () {
      await expect(
        hectorBridge.connect(alice).setCountDest(countDest)
      ).to.be.reverted
    });

    it('Compare counts after adding', async function () {
      const result = await hectorBridge
        .connect(deployer)
        .setCountDest(countDest);
      await result.wait();
      await waitSeconds(3);
      expect(await hectorBridge.connect(deployer).countDest()).equal(countDest);
    });
  });
});
