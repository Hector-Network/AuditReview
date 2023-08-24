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
  HectorFNFT,
} from '../../types';
import deploy from '../../deploy/hec-tor-script';

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

  let FNFT: HectorFNFT;
  let RNFT: HectorFNFT;

  let hectorRegistration: HectorRegistration;
  let hectorRedemption: HectorRedemption;
  let treasury: HectorRedemptionTreasury;
  let vaultFNFT: TokenVault; //For previous FNFT Vault
  let vaultRNFT: TokenVault; //New RNFT Receipt
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
    RNFT = (await FNFTFactory.deploy()) as HectorFNFT;

    let eligibleTokens = [hecToken.address, wsHec.address, sHec.address];

    //Deploy Registration
    const HectorRegistrationFactory = await ethers.getContractFactory(
      'HectorRegistration'
    );
    hectorRegistration = (await HectorRegistrationFactory.deploy(
      multisig.address,
      moderator.address,
      eligibleTokens,
      FNFT.address
    )) as HectorRegistration;

    //Deploy Redemption
    const HectorRedemptionFactory = await ethers.getContractFactory(
      'HectorRedemption'
    );

    hectorRedemption = (await HectorRedemptionFactory.deploy(
      multisig.address,
      moderator.address,
      hectorRegistration.address,
      FNFT.address
    )) as HectorRedemption;

    //Deploy Treasury
    const HectorTreasuryFactory = await ethers.getContractFactory(
      'HectorRedemptionTreasury'
    );

    treasury = (await HectorTreasuryFactory.deploy(
      multisig.address,
      moderator.address,
      RNFT.address
    )) as HectorRedemptionTreasury;

    const TokenVaultFactory = await ethers.getContractFactory('TokenVault');
    vaultFNFT = (await TokenVaultFactory.deploy(
      multisig.address,
      deployer.address,
      FNFT.address,
      treasury.address
    )) as TokenVault;

    vaultRNFT = (await TokenVaultFactory.deploy(
      multisig.address,
      deployer.address,
      RNFT.address,
      treasury.address
    )) as TokenVault;

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

  /**
   * Test Redemption Cases
   * 0. Fund Treasury  ✅
   * 1. End to End Redemption for ERC20
   * 1.1
   * 2. End to End Redemption for ERC721
   * 3. Test bad cases for ERC20
   * 4. Test bad cases for ERC721
   * 5. Test cases for Treasury ✅
   * 6. Test cases for TokenVault
   */

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
      expect(nftId).to.equal('1');

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
      const nftId = 1;

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
      const nftId = 1;

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
        redeemableAmount: 100,
      };

      const _owner = await RNFT.owner();
      console.log('RNFT Owner', _owner);
      console.log('Deployer', deployer.address);
      console.log('Multisig', multisig.address);
      console.log('Moderator', moderator.address);

      let tx = await vaultRNFT
        .connect(deployer)
        .mint(registeredWallet.address, fnftConfig);

      // expect(await RNFT.balanceOf(registeredWallet.address)).to.equal('2');

      // await expect(tx)
      //   .to.emit(treasury, 'RedeemNFTMinted')
      //   .withArgs(
      //     registeredWallet.address,
      //     2,
      //     fnftConfig.eligibleTORAmount,
      //     fnftConfig.eligibleHECAmount,
      //     fnftConfig.redeemableAmount
      //   );
    });
  });
});
