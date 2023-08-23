// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import './interfaces/ITokenVault.sol';
import './interfaces/IFNFT.sol';
import './interfaces/IRedemptionTreasury.sol';

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
    Pausable,
    Ownable,
    AccessControl
{
    using SafeERC20 for IERC20;

    /// @notice setup moderator role
    bytes32 public constant MODERATOR_ROLE = keccak256('MODERATOR_ROLE');

    /// @notice Redeem fnft contract
    FNFT public fnft;

    /// @notice redemption treasury contract
    IRedemptionTreasury public treasury;

    /// @notice FNFT configuration
    mapping(uint256 => FNFTConfig) private fnfts;

    /* ======= CONSTRUCTOR ======= */

    constructor(address multisigWallet,  address moderator,  address _fnft, address _treasury) {
        if (multisigWallet == address(0)) revert INVALID_ADDRESS();
        if (moderator == address(0)) revert INVALID_ADDRESS();
        if (_fnft == address(0)) revert INVALID_ADDRESS();
        if (_treasury == address(0)) revert INVALID_ADDRESS();

        fnft = FNFT(_fnft);
        treasury = IRedemptionTreasury(_treasury);

        _transferOwnership(multisigWallet);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
		_setupRole(MODERATOR_ROLE, msg.sender);
        _setupRole(MODERATOR_ROLE, moderator);
    }

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
        onlyRole(MODERATOR_ROLE)
        returns (uint256)
    {
        if (recipient == address(0)) revert INVALID_ADDRESS();
        if (fnftConfig.redeemableAmount == 0 ||
            (fnftConfig.redeemTORAmount == 0 && 
            fnftConfig.redeemHECAmount == 0)) revert INVALID_AMOUNT();

        uint256 fnftId = fnft.mint(recipient);
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
        onlyRole(MODERATOR_ROLE)
    {
        if (fnft.ownerOf(rnftid) != recipient || fnft.balanceOf(recipient) == 0) revert INVALID_RECIPIENT();

        FNFTConfig memory fnftConfig = fnfts[fnftId];

        fnft.burn(fnftId);        

        treasury.transferRedemption(
            fnftId,
            fnftConfig.redeemableToken,
            recipient,
            fnftConfig.redeemableAmount
        );

        delete fnfts[fnftId];

        emit RedeemNFTWithdrawn(recipient, fnftId, fnftConfig.depositAmount);
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
