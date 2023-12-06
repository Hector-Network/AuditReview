// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";
import '../interfaces/ITokenVault.sol';
import '../interfaces/IFNFT.sol';
import './LockAccessControl.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_WALLET();
error INVALID_BALANCE();
error INVALID_RECIPIENT();

// Credits to Revest Team
// Github:https://github.com/Revest-Finance/RevestContracts/blob/master/hardhat/contracts/TokenVault.sol
contract TokenVault is
    ITokenVault,
    LockAccessControl,
    Pausable
{
    using SafeERC20 for IERC20;

    /// @notice rnft configuration
    mapping(uint256 => RedeemNFTConfig) private rnfts;

    /* ======= CONSTRUCTOR ======= */

   constructor(address provider) LockAccessControl(provider) {}

    ///////////////////////////////////////////////////////
    //               MANAGER CALLED FUNCTIONS            //
    ///////////////////////////////////////////////////////

    function pause() external onlyOwner whenNotPaused {
        return _pause();
    }

    function unpause() external onlyOwner whenPaused {
        return _unpause();
    }

    ///////////////////////////////////////////////////////
    //               USER CALLED FUNCTIONS               //
    ///////////////////////////////////////////////////////

    /**
     * @notice Mint a new rnft to acknowledge receipt of user's tokens
     * @param recipient The address to receive the rnft
     * @param rnftConfig The rnft configuration
     * @return The rnft ID
     */
    function mint(address recipient, RedeemNFTConfig memory rnftConfig)
        external
        whenNotPaused
        onlyModerator
        returns (uint256)
    {
        if (recipient == address(0)) revert INVALID_ADDRESS();
        if (rnftConfig.redeemableAmount == 0 ||
            (rnftConfig.eligibleTORAmount == 0 && 
            rnftConfig.eligibleHECAmount == 0)) revert INVALID_AMOUNT();

        uint256 rnftId = getRNFT().mint(recipient);
        rnfts[rnftId] = rnftConfig;

        emit RedeemNFTMinted(
            recipient,
            rnftId,
            rnftConfig.eligibleTORAmount,
            rnftConfig.eligibleHECAmount, 
            rnftConfig.redeemableAmount
        );

        return rnftId;
    }

    /**
     * @notice Withdraw a rnft and redeem the user's tokens
     * @param recipient The address to receive the rnft
     * @param rnftId The rnft ID
     */
    function withdraw(address recipient, uint256 rnftId)
        external
        whenNotPaused
        onlyModerator
    {
        IRedemptionNFT rnft = getRNFT();

        if (rnft.ownerOf(rnftId) != recipient || rnft.balanceOf(recipient) == 0) revert INVALID_RECIPIENT();

        RedeemNFTConfig memory rnftConfig = rnfts[rnftId];

        getTreasury().transferRedemption(
            rnftId,
            rnftConfig.redeemableToken,
            recipient,
            rnftConfig.redeemableAmount
        );

        rnft.burnFromOwner(rnftId, recipient); 

        delete rnfts[rnftId];

        emit RedeemNFTWithdrawn(recipient, rnftId, rnftConfig.redeemableAmount);
    }

    /**
     * @notice Mint & Withdraw from one recipient
     * @param recipient The address to receive the rnft
     * @param redeemAmount The amount to redeem
     */
    function mintWithdraw(address recipient, uint256 redeemAmount)  external
        whenNotPaused
        onlyModerator
        returns (uint256) {

        uint256 rnftId = _mintWithdraw(recipient, redeemAmount);
        return rnftId;
    }

    /**
     * @notice Mint & Withdraw from a list of recipients
     * @param recipients The address to receive the rnft
     * @param amounts amount to be redeemed
     */
    function mintWithdraws(address[] memory recipients, uint256[] memory amounts)  external
        whenNotPaused
        onlyModerator
    {
        uint256 totalRecipients = recipients.length;
        uint256 totalConfig = amounts.length;

        if (totalRecipients != totalConfig) revert INVALID_PARAM();

        for (uint256 i = 0; i < totalRecipients; i++) {
            address recipient = recipients[i];
            uint256 redeemAmount = amounts[i];
            _mintWithdraw(recipient, redeemAmount);
        }   
    }

    /**
        * @notice Mint & Withdraw from a recipient
        * @param recipient The address to receive the rnft
        * @param redeemAmount The amount to redeem
     */
    function _mintWithdraw(address recipient, uint256 redeemAmount)  internal
        returns (uint256) {

        if (recipient == address(0)) revert INVALID_ADDRESS();
        if (redeemAmount == 0) revert INVALID_AMOUNT();

        RedeemNFTConfig memory rnftConfig = RedeemNFTConfig({
            eligibleTORAmount: 1,
            eligibleHECAmount: 1,
            redeemableAmount: redeemAmount,
            redeemableToken: getRedeemToken()
        });

        uint256 rnftId = getRNFT().mint(recipient);
        rnfts[rnftId] = rnftConfig;

        emit RedeemNFTMinted(
            recipient,
            rnftId,
            rnftConfig.eligibleTORAmount,
            rnftConfig.eligibleHECAmount, 
            rnftConfig.redeemableAmount
        );

        IRedemptionNFT rnft = getRNFT();

        getTreasury().transferRedemption(
            rnftId,
            rnftConfig.redeemableToken,
            recipient,
            rnftConfig.redeemableAmount
        );

        rnft.burnFromOwner(rnftId, recipient); 

        delete rnfts[rnftId];

        return rnftId;
    }

    ///////////////////////////////////////////////////////
    //                  VIEW FUNCTIONS                   //
    ///////////////////////////////////////////////////////

    /**
     * @notice Returns the rnft configuration
     * @param rnftId The rnft ID
     * @return The rnft configuration
     */
    function getRNFT(uint256 rnftId)
        external
        view
        returns (RedeemNFTConfig memory)
    {
        return rnfts[rnftId];
    }
}
