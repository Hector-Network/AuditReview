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

    /// @notice FNFT configuration
    mapping(uint256 => FNFTConfig) private fnfts;

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
     * @notice Mint a new FNFT to acknowledge receipt of user's tokens
     * @param recipient The address to receive the FNFT
     * @param fnftConfig The FNFT configuration
     * @return The FNFT ID
     */
    function mint(address recipient, FNFTConfig memory fnftConfig)
        external
        whenNotPaused
        onlyModerator
        returns (uint256)
    {
        if (recipient == address(0)) revert INVALID_ADDRESS();
        if (fnftConfig.redeemableAmount == 0 ||
            (fnftConfig.eligibleTORAmount == 0 && 
            fnftConfig.eligibleHECAmount == 0)) revert INVALID_AMOUNT();

        uint256 fnftId = getFNFT().mint(recipient);
        fnfts[fnftId] = fnftConfig;

        emit RedeemNFTMinted(
            recipient,
            fnftId,
            fnftConfig.eligibleTORAmount,
            fnftConfig.eligibleHECAmount, 
            fnftConfig.redeemableAmount
        );

        return fnftId;
    }

    /**
     * @notice Withdraw a FNFT and redeem the user's tokens
     * @param recipient The address to receive the FNFT
     * @param fnftId The FNFT ID
     */
    function withdraw(address recipient, uint256 fnftId)
        external
        whenNotPaused
        onlyModerator
    {
        IFNFT fnft = getFNFT();

        if (fnft.ownerOf(fnftId) != recipient || fnft.balanceOf(recipient) == 0) revert INVALID_RECIPIENT();

        FNFTConfig memory fnftConfig = fnfts[fnftId];

        getTreasury().transferRedemption(
            fnftId,
            fnftConfig.redeemableToken,
            recipient,
            fnftConfig.redeemableAmount
        );

        fnft.burnFromOwner(fnftId, recipient); 

        delete fnfts[fnftId];

        emit RedeemNFTWithdrawn(recipient, fnftId, fnftConfig.redeemableAmount);
    }

    /**
     * @notice Mint & Withdraw from one recipient
     * @param recipient The address to receive the FNFT
     * @param redeemAmount The amount to redeem
     */
    function mintWithdraw(address recipient, uint256 redeemAmount)  external
        whenNotPaused
        onlyModerator
        returns (uint256) {

        uint256 fnftId = _mintWithdraw(recipient, redeemAmount);
        return fnftId;
    }

    /**
     * @notice Mint & Withdraw from a list of recipients
     * @param recipients The address to receive the FNFT
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
        * @param recipient The address to receive the FNFT
        * @param redeemAmount The amount to redeem
     */
    function _mintWithdraw(address recipient, uint256 redeemAmount)  internal
        returns (uint256) {

        if (recipient == address(0)) revert INVALID_ADDRESS();
        if (redeemAmount == 0) revert INVALID_AMOUNT();

        FNFTConfig memory fnftConfig = FNFTConfig({
            eligibleTORAmount: 1,
            eligibleHECAmount: 1,
            redeemableAmount: redeemAmount,
            redeemableToken: getRedeemToken()
        });

        uint256 fnftId = getFNFT().mint(recipient);
        fnfts[fnftId] = fnftConfig;

        emit RedeemNFTMinted(
            recipient,
            fnftId,
            fnftConfig.eligibleTORAmount,
            fnftConfig.eligibleHECAmount, 
            fnftConfig.redeemableAmount
        );

        IFNFT fnft = getFNFT();

        getTreasury().transferRedemption(
            fnftId,
            fnftConfig.redeemableToken,
            recipient,
            fnftConfig.redeemableAmount
        );

        fnft.burnFromOwner(fnftId, recipient); 

        delete fnfts[fnftId];

        return fnftId;
    }

    ///////////////////////////////////////////////////////
    //                  VIEW FUNCTIONS                   //
    ///////////////////////////////////////////////////////

    /**
     * @notice Returns the FNFT configuration
     * @param fnftId The FNFT ID
     * @return The FNFT configuration
     */
    function getFNFT(uint256 fnftId)
        external
        view
        returns (FNFTConfig memory)
    {
        return fnfts[fnftId];
    }
}
