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

    hectorRedemption = (await HectorRedemptionFactory.deploy(
      lockAddressRegistry.address,
      hectorRegistration.address
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
      treasury.address
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

      //Check if the NFTs are transferred to the vault
      expect(await RNFT.balanceOf(testWallet2.address)).to.equal('1');

      //check nft balance on hector redemption
      expect(await RNFT.balanceOf(hectorRedemption.address)).to.equal('2');
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
  });
});
