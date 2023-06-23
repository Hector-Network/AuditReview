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
  let blocksNeededForQueue = 28800; // 8 hours
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
      [countDest, blocksNeededForQueue],
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
        await hectorBridge.reserveBridgeQueue(lifiBridge)
      ).to.be.greaterThan(0);

      expect(
        await hectorBridge.reserveBridgeQueue(alice.address)
      ).to.be.greaterThan(0);
    });

    it('Should Fail: update values before queue time is over', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGES,
        lifiBridge
      );

      await expect(
        hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge)
      ).to.be.revertedWithCustomError(hectorBridge, 'QUEUE_NOT_EXPIRED');
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
    it('Should Fail - Add duplicated bridge contract', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);

      //check if bridge exists
      expect(await hectorBridge.reserveBridges(0)).equal(lifiBridge);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);
      await increaseTime(blocksNeededForQueue + 5);
      const tx = await hectorBridge.toggle(
        MANAGING.RESERVE_BRIDGES,
        lifiBridge
      );

      await expect(
        hectorBridge.reserveBridges(1)
      ).to.be.revertedWithoutReason();
    });
    it('Should Pass - Delete bridge contract', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);

      //check if bridge exists
      expect(await hectorBridge.reserveBridges(0)).equal(lifiBridge);

      const tx = await hectorBridge.removeReserveBridge(lifiBridge);
      await expect(
        hectorBridge.reserveBridges(0)
      ).to.be.revertedWithoutReason();
    });
    it('Should Pass - Update bridge contract', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);

      //Delete
      await hectorBridge.removeReserveBridge(lifiBridge);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, alice.address);
      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, alice.address);

      expect(await hectorBridge.reserveBridges(0)).equal(alice.address);
    });

    it('isReserveBridge to true after adding', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);
      expect(await hectorBridge.isReserveBridge(lifiBridge)).equal(true);
    });

    it('isReserveBridge to false after removing', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, lifiBridge);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, lifiBridge);
      await hectorBridge.removeReserveBridge(lifiBridge);

      expect(await hectorBridge.isReserveBridge(lifiBridge)).equal(false);
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
        await hectorBridge.reserveBridgeAssetQueue(lifiBridge)
      ).to.be.greaterThan(0);

      expect(
        await hectorBridge.reserveBridgeAssetQueue(alice.address)
      ).to.be.greaterThan(0);
    });

    it('Should Fail: update values before queue time is over', async function () {
      const txQueue = await hectorBridge.queue(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        token.address
      );

      await expect(
        hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address)
      ).to.be.revertedWithCustomError(hectorBridge, 'QUEUE_NOT_EXPIRED');
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

    it('Should Fail - Add duplicated bridge asset', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      //check if bridge exists
      expect(await hectorBridge.reserveBridgeAssets(0)).equal(token.address);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);
      await increaseTime(blocksNeededForQueue + 5);
      const tx = await hectorBridge.toggle(
        MANAGING.RESERVE_BRIDGE_ASSETS,
        token.address
      );

      await expect(
        hectorBridge.reserveBridgeAssets(1)
      ).to.be.revertedWithoutReason();
    });
    it('Should Pass - Delete bridge asset', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      //check if bridge exists
      expect(await hectorBridge.reserveBridgeAssets(0)).equal(token.address);

      const tx = await hectorBridge.removeReserveBridgeAsset(token.address);
      await expect(
        hectorBridge.reserveBridgeAssets(0)
      ).to.be.revertedWithoutReason();
    });
    it('Should Pass - Update bridge asset', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      //Delete
      await hectorBridge.removeReserveBridgeAsset(token.address);

      //Add again
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, alice.address);
      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, alice.address);

      expect(await hectorBridge.reserveBridgeAssets(0)).equal(alice.address);
    });

    it('isReserveBridgeAsset to true after adding asset', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);
      expect(await hectorBridge.isReserveBridgeAsset(token.address)).equal(
        true
      );
    });

    it('isReserveBridgeAsset to false after removing asset', async function () {
      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);

      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, token.address);
      await hectorBridge.removeReserveBridgeAsset(token.address);

      expect(await hectorBridge.isReserveBridgeAsset(token.address)).equal(
        false
      );
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
      await expect(hectorBridge.connect(alice).setDAO(dao)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
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
      ).to.be.revertedWith('Ownable: caller is not the owner');
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
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Compare counts after adding', async function () {
      const result = await hectorBridge
        .connect(deployer)
        .setCountDest(countDest);
      await result.wait();
      await waitSeconds(3);
      expect(await hectorBridge.connect(deployer).CountDest()).equal(countDest);
    });
  });

  describe('#Test Bridge Operation Using Squid', () => {
    let ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    let mockSendingAssetInfos: any[] = [];
    let fees: Array<BigNumber> = [];
    let feesForNative: Array<BigNumber> = [];
    let fee: BigNumber = BigNumber.from(0);

    let mockSendingAssetInfo1: {
      callData: string;
      sendingAmount: string;
      totalAmount: string; // Mock Total Amount
      feeAmount: string;
      bridgeFee: string;
    };

    let sendingAsset: string;
    let targetAddress: string;

    let callData = tempStepDataForSquid.transactionRequest.data;
    let sendingAmount = tempStepDataForSquid.params.fromAmount; // This is calculated amount except fee for using Bridge
    let totalAmount = BigNumber.from('11000').toString(); // Mock Total Amount
    let feeAmount = BigNumber.from('11000')
      .sub(BigNumber.from(tempStepDataForSquid.params.fromAmount))
      .toString(); // MockFee - 0.075%
    let bridgeFee = BigNumber.from(
      tempStepDataForSquid.transactionRequest.value
    ).toString();

    let isNativeFrom =
      tempStepDataForSquid.params.fromToken.address == ETH_ADDRESS;

    before(async function () {
      mockSendingAssetInfo1 = {
        callData: callData,
        sendingAmount: sendingAmount,
        totalAmount: totalAmount, // Mock Total Amount
        feeAmount: feeAmount,
        bridgeFee: bridgeFee,
      };
      // Sending Asset Id
      sendingAsset = isNativeFrom
        ? ZERO_ADDRESS
        : tempStepDataForSquid.params.fromToken.address;

      await hectorBridge.queue(MANAGING.RESERVE_BRIDGE_ASSETS, sendingAsset);
      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGE_ASSETS, sendingAsset);

      targetAddress = tempStepDataForSquid.transactionRequest.targetAddress;

      fees.push(BigNumber.from(bridgeFee));

      if (isNativeFrom) {
        feesForNative.push(BigNumber.from(feeAmount));
      }

      fees.map((item) => {
        fee = fee.add(item);
      });

      feesForNative.map((item) => {
        fee = fee.add(item);
      });

      mockSendingAssetInfos.push(mockSendingAssetInfo1);

      if (!isNativeFrom) {
        let approveAmount = BigNumber.from(totalAmount);

        const ERC20Contract = new ethers.Contract(
          sendingAsset,
          erc20Abi.abi,
          deployer
        );

        await waitSeconds(3);

        let txApprove = await ERC20Contract.connect(deployer).approve(
          hectorBridge.address,
          approveAmount
        );

        await txApprove.wait();
      }

      await hectorBridge.queue(MANAGING.RESERVE_BRIDGES, squidRouter);
      await increaseTime(blocksNeededForQueue + 5);
      await hectorBridge.toggle(MANAGING.RESERVE_BRIDGES, squidRouter);

      const txSetDao = await hectorBridge.connect(deployer).setDAO(dao);
      await txSetDao.wait();
    });

    it('Success Tx For Squid Bridge', async function () {
      const result = await hectorBridge.bridge(
        sendingAsset,
        mockSendingAssetInfos,
        targetAddress,
        {
          value: fee,
        }
      );
      await expect(result.wait()).not.to.be.reverted;
    });

    it('Failed Tx when call fake targetAddress', async function () {
      const result = await hectorBridge
        .connect(deployer)
        .bridge(
          sendingAsset,
          mockSendingAssetInfos,
          '0xbf014a15198edcfcb2921de7099bf256db31c4ba',
          {
            value: fee,
            gasLimit: 1000000,
          }
        );

      await expect(result.wait()).to.be.rejectedWith(
        'Bridge: Invalid parameters'
      );
    });

    it('Failed Tx when send fake asset', async function () {
      const result = await hectorBridge
        .connect(deployer)
        .bridge(
          '0xbf014a15198edcfcb2921de7099bf256db31c4ba',
          mockSendingAssetInfos,
          targetAddress,
          {
            value: fee,
            gasLimit: 1000000,
          }
        );
      await expect(result.wait()).to.be.reverted;
    });

    it('Failed Tx when send fake assetInfos', async function () {
      const result = await hectorBridge.connect(deployer).bridge(
        sendingAsset,
        [
          {
            callData: '0xadde0800',
            sendingAmount: sendingAmount,
            totalAmount: totalAmount, // Mock Total Amount
            feeAmount: feeAmount,
            bridgeFee: bridgeFee,
          },
        ],
        targetAddress,
        {
          value: fee,
          gasLimit: 1000000,
        }
      );
      await expect(result.wait()).to.be.reverted;
    });

    describe('#pausable', () => {
      it('Failed Bridge Tx when paused', async function () {
        const txPause = await hectorBridge.pause();
        await txPause.wait();
        await expect(
          hectorBridge
            .connect(deployer)
            .bridge(sendingAsset, mockSendingAssetInfos, targetAddress, {
              value: fee,
            })
        ).to.be.revertedWith('Pausable: paused');
      });

      it('Success Tx when unpause', async function () {
        const unpauseTx = await hectorBridge.unpause();
        await unpauseTx.wait();
        if (!isNativeFrom) {
          let approveAmount = BigNumber.from(totalAmount);

          const ERC20Contract = new ethers.Contract(
            sendingAsset,
            erc20Abi.abi,
            deployer
          );

          await waitSeconds(3);

          let txApprove = await ERC20Contract.connect(deployer).approve(
            hectorBridge.address,
            approveAmount
          );

          await txApprove.wait();
        }
        const result = await hectorBridge.bridge(
          sendingAsset,
          mockSendingAssetInfos,
          targetAddress,
          {
            value: fee,
          }
        );
        await expect(result.wait()).not.to.be.reverted;
      });
    });
  });
});
