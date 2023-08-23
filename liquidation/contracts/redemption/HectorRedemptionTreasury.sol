// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/security/Pausable.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";
import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';
import '../interfaces/ITokenVault.sol';


error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_TOKEN();
error INVALID_RECIPIENT();

contract HectorRedemptionTreasury is Ownable, Pausable, AccessControl {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice setup moderator role
    bytes32 public constant MODERATOR_ROLE = keccak256('MODERATOR_ROLE');

    /// @notice Redeem fnft contract
    IERC721Enumerable public fnft;

    /// @notice Deposited tokens set
    EnumerableSet.AddressSet private tokensSet;


    /* ======== EVENTS ======== */

    event Deposited(address indexed who, address indexed token, uint256 amount);
    event SetModerator(address _moderator, bool _approved);
    event SendRedemption(address indexed who, uint256 fnftid, uint256 amount);

    /* ======== INITIALIZATION ======== */
    constructor(address multisigWallet, address moderator, address _redeemFNFT) {
       if (multisigWallet == address(0)) revert INVALID_ADDRESS();
       if (moderator == address(0)) revert INVALID_ADDRESS();
       if (_redeemFNFT == address(0)) revert INVALID_ADDRESS();

        fnft = IERC721Enumerable(_redeemFNFT);

        _transferOwnership(multisigWallet);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
		_setupRole(MODERATOR_ROLE, msg.sender);
        _setupRole(MODERATOR_ROLE, moderator);
    }

    /* ======== POLICY FUNCTIONS ======== */

    /**
        @notice add moderator 
        @param _moderator new/existing wallet address
		@param _approved active/inactive flag
     */
    function setModerator(address _moderator, bool _approved) external onlyRole(DEFAULT_ADMIN_ROLE) {
		if (_moderator == address(0)) revert INVALID_ADDRESS();
		if (_approved) grantRole(MODERATOR_ROLE, _moderator);
		else revokeRole(MODERATOR_ROLE, _moderator);
		emit SetModerator(_moderator, _approved);
	}

    function pause() external onlyRole(MODERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MODERATOR_ROLE) {
        _unpause();
    }

    /**
        @notice transfer redemption funds to user
        @param rnftid  fnft id
        @param _token  token address
        @param _to  recipient address
        @param _amount  amount to transfer
     */
    function transferRedemption(uint256 rnftid, address _token, address _to, uint256 _amount) external onlyRole(MODERATOR_ROLE) {        
        if (_token == address(0)) revert INVALID_ADDRESS();
        if (_to == address(0)) revert INVALID_ADDRESS();     
        if (!tokensSet.contains(_token)) revert INVALID_TOKEN();
        if (fnft.ownerOf(rnftid) != _to || fnft.balanceOf(_to) == 0) revert INVALID_RECIPIENT();

        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance < _amount) revert INVALID_AMOUNT();

        IERC20(_token).safeTransfer(_to, _amount);

        emit SendRedemption(_to, rnftid, _amount);
    }

    /**
        @notice withdraw all tokens
     */    
    function withdrawAll() external onlyRole(MODERATOR_ROLE) {
        uint256 length = tokensSet.length();

        for (uint256 i = 0; i < length; i++) {
            address token = tokensSet.at(0);
            uint256 balance = IERC20(token).balanceOf(address(this));

            if (balance > 0) {
                IERC20(token).safeTransfer(owner(), balance);
            }

            tokensSet.remove(token);
        }
    }

    /**
        @notice deposit redemption funds to contract
     */ 
    function deposit(address _token, uint256 _amount) external whenNotPaused onlyRole(MODERATOR_ROLE) {
        if (_token == address(0)) revert INVALID_ADDRESS();
        if (_amount == 0) revert INVALID_AMOUNT();

        tokensSet.add(_token);

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposited(msg.sender, _token, _amount);
    }

}
