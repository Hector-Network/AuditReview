// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/security/Pausable.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";
import {IRegistrationWallet} from '../interfaces/IRegistrationWallet.sol';

error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_WALLET();

contract HectorRedemptionTreasury is Ownable, Pausable, AccessControl {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice setup moderator role
    bytes32 public constant MODERATOR_ROLE = keccak256('MODERATOR_ROLE');

    /// @notice DAO wallet
    address public dao;

    /// @notice Deposited tokens set
    EnumerableSet.AddressSet private tokensSet;
    /// @notice Registered wallets
    EnumerableSet.AddressSet private registeredWallets;

    IRegistrationWallet public registrationWalletContract;

    /* ======== EVENTS ======== */

    event Deposited(address indexed who, address indexed token, uint256 amount);
    event SetModerator(address _moderator, bool _approved);
    event SendRedemption(address indexed who, address indexed token, uint256 amount);

    /* ======== INITIALIZATION ======== */
    constructor(address _dao, address multisigWallet, address moderator, address _registrationWallet) {
       if (_dao == address(0)) revert INVALID_ADDRESS();
       if (_registrationWallet == address(0)) revert INVALID_ADDRESS();

        dao = _dao;

        registrationWalletContract = IRegistrationWallet(_registrationWallet);
        address[] memory _wallets = registrationWalletContract.getAllWallets();

        _convertArrayToEnumerableSet(_wallets);

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

    function setDAO(address _dao) external onlyRole(MODERATOR_ROLE) {
        if (_dao == address(0)) revert INVALID_ADDRESS();

        dao = _dao;
    }

    /* ======== DAO FUNCTIONS ======== */

    /**
        @notice send redemption token to user
     */ 
    function transferRedemption(address _token, address _to, uint256 _amount) external onlyRole(MODERATOR_ROLE) {
        if (_token == address(0)) revert INVALID_ADDRESS();
        if (_to == address(0)) revert INVALID_ADDRESS();
        if (_amount == 0) revert INVALID_AMOUNT();        
        if (!registeredWallets.contains(_to)) revert INVALID_WALLET();
        if (!tokensSet.contains(_token)) revert INVALID_WALLET();

        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance < _amount) revert INVALID_AMOUNT();

        IERC20(_token).safeTransfer(_to, _amount);

        emit SendRedemption(_to, _token, _amount);
    }

    /**
        @notice withdraw tokens
     */ 
    function withdrawTokens(address[] memory _tokens) external onlyRole(MODERATOR_ROLE) {
        uint256 length = _tokens.length;

        for (uint256 i = 0; i < length; i++) {
            address token = _tokens[i];
            if (token == address(0)) revert INVALID_ADDRESS();

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).safeTransfer(dao, balance);
            }
        }
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
                IERC20(token).safeTransfer(dao, balance);
            }

            tokensSet.remove(token);
        }
    }

    /* ======== USER FUNCTIONS ======== */

    /**
        @notice deposit token
     */ 
    function deposit(address _token, uint256 _amount) external whenNotPaused {
        if (_token == address(0)) revert INVALID_ADDRESS();
        if (_amount == 0) revert INVALID_AMOUNT();

        tokensSet.add(_token);

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposited(msg.sender, _token, _amount);
    }

    function _convertArrayToEnumerableSet(address[] memory _wallets) private {
        uint256 length = _wallets.length;

        for (uint256 i = 0; i < length; i++) {
            registeredWallets.add(_wallets[i]);
        }
    }
}
