// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';

import {IRegistrationWallet} from '../interfaces/IRegistrationWallet.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_TIME();
error INVALID_MODERATOR();


contract HectorSubscription is
    IRegistrationWallet,
    OwnableUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20 for IERC20;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice last day to register wallets
    uint256 lastDayToRegister;

    /// @notice registered wallets from users
    Wallet[] public wallets;
    EnumerableSetUpgradeable.AddressSet public registeredWallets;

    /// @notice user wallet => array of tokens
    mapping(address => Token[]) public tokensInWallet;

    /// @notice setup moderator role
    bytes32 public constant MODERATOR_ROLE = keccak256('MODERATOR_ROLE');

    /* ======== EVENTS ======== */
    event SetModerator(address _moderator, bool _approved);
    event SetRegistrationExpirationTime(uint256 oldValue, uint256 newValue);
    event AddRegisteredWallet(address walletAddress, address[] tokenAddresses, uint256[] eligibleAmounts, 
                            uint256[] ineligibleAmounts, uint8[] decimals);


    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 timestamp, address multisigWallet, address moderator) external initializer {
        if (timestamp <= 0) revert INVALID_PARAM();
        lastDayToRegister = timestamp;

        _transferOwnership(multisigWallet);
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
		_setupRole(MODERATOR_ROLE, msg.sender);
        _setupRole(MODERATOR_ROLE, moderator);
    }

    /* ======== MODIFIER ======== */



    /* ======== POLICY FUNCTIONS ======== */

    /**
        @notice set Registration Expiration Time
        @param timestamp new Expiration Time
     */
    function setRegistrationExpirationTime(uint256 timestamp) external onlyOwner {
         if (timestamp <= 0) revert INVALID_PARAM();
         uint256 oldValue = lastDayToRegister;
        lastDayToRegister = timestamp;
        emit SetRegistrationExpirationTime(oldValue, timestamp);
    }

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

    /* ======== MODERATOR FUNCTIONS ======== */

    /**
        @notice register wallet
        @param _wallet Wallet data type
     */
    function registerWallet(address walletAddress, 
                            address[] memory tokenAddresses,                            
                            uint256[] memory eligibleAmounts,
                            uint256[] memory ineligibleAmounts,
                            uint8[] memory decimals) external onlyRole(MODERATOR_ROLE) {    
        uint256 length = tokenAddresses.length;

        if (length != eligibleAmounts.length) revert INVALID_PARAM();
        if (length != ineligibleAmounts.length) revert INVALID_PARAM();
        if (length != decimals.length) revert INVALID_PARAM();

        Wallet memory wallet = Wallet({walletAddress: walletAddress, tokens: new Token[](length)});

        for (uint256 i = 0; i < length; i++) {
            Token memory token = Token({
                tokenAddress: tokenAddresses[i],
                eligibleAmount: eligibleAmounts[i],
                ineligibleAmount: ineligibleAmounts[i],
                decimals: decimals[i]
            });

            wallet.tokens[i] = token;
            tokensInWallet[walletAddress].push(token);
        }

        wallets.push(wallet);

        emit AddRegisteredWallet(
            walletAddress,
            tokenAddresses,
            eligibleAmounts,
            ineligibleAmounts,
            decimals
        );        
    }

    /* ======== VIEW FUNCTIONS ======== */

    /// @notice Returns the length of registered wallets
	function getRegisteredWalletsCount() external view returns (uint256) {
		return registeredWallets.length();
	}

	/**
        @notice return if wallet is registered
        @param _address address
        @return bool
     */
	function isRegisteredWallet(address _walletAddress) external view returns (bool) {
		return registeredWallets.contains(_walletAddress);
	}

    /// @notice Returns wallet info
    function getTokensInWallet(address _walletAddress) external view returns (Token[] memory) {
        return tokensInWallet[_walletAddress];
    }

     /// @notice Returns all wallet addresses
    function getAllWallets() external view returns (address[] memory) {
        return registeredWallets.values();
    }

    /* ======== USER FUNCTIONS ======== */

   
}
