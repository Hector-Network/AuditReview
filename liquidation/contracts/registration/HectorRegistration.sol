// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";
import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';

import {IRegistrationWallet} from '../interfaces/IRegistrationWallet.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_TIME();
error INVALID_WALLET();
error INVALID_BALANCE();


contract HectorRegistration is
    IRegistrationWallet,
    Ownable,
    AccessControl
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice registered wallets from users
    Wallet[] public wallets;
    EnumerableSet.AddressSet private registeredWallets;
    EnumerableSet.AddressSet private blacklistedWallets;
    EnumerableSet.AddressSet private eligibleTokens;

    /// @notice user wallet => array of tokens
    mapping(address => Token[]) public tokensInWallet;

    /// @notice setup moderator role
    bytes32 public constant MODERATOR_ROLE = keccak256('MODERATOR_ROLE');

    IERC721Enumerable public fnft; // FNFT contract

    /* ======== EVENTS ======== */
    event SetModerator(address _moderator, bool _approved);
    event AddBlacklistedWallet(address wallet);
    event RemoveBlacklistedWallet(address wallet);
    event SetRegistrationExpirationTime(uint256 oldValue, uint256 newValue);
    event AddRegisteredWallet(address walletAddress);
    event AddEligibleToken(address token);


    /* ======== INITIALIZATION ======== */

    constructor(address multisigWallet, address moderator, address[] memory _tokens, address _fnft) {
        if (multisigWallet == address(0)) revert INVALID_ADDRESS();
        if (moderator == address(0)) revert INVALID_ADDRESS();
        if (_fnft == address(0)) revert INVALID_ADDRESS();

        fnft = IERC721Enumerable(_fnft);

        _addEligibleTokens(_tokens);
        _transferOwnership(multisigWallet);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
		_setupRole(MODERATOR_ROLE, msg.sender);
        _setupRole(MODERATOR_ROLE, moderator);
    }

    /* ======== PRIVATE ======== */
    /**
        @notice add eligible token
        @param _token  wallet address
     */
    function _addEligibleToken(address _token) private {
        //check for duplicate
        if (_token == address(0) || eligibleTokens.contains(_token)) revert INVALID_WALLET();

        eligibleTokens.add(_token);

		emit AddEligibleToken(_token);
	}

    function _addEligibleTokens(address[] memory _tokens) private {
        uint256 length = _tokens.length;

        for (uint256 i = 0; i < length; i++) {
            _addEligibleToken(_tokens[i]);
        }
	}

    /**
        @notice add blacklist wallet 
        @param _wallet  wallet address
     */
    function _addBlacklistWallet(address _wallet) private {
        //check for duplicate
        if (_wallet == address(0) || blacklistedWallets.contains(_wallet)) revert INVALID_WALLET();

        blacklistedWallets.add(_wallet);

		emit AddBlacklistedWallet(_wallet);
	}

     /**
        @notice add blacklist wallet 
        @param _wallet  wallet address
     */
    function _removeBlacklistWallet(address _wallet) private {
        //check for duplicate
        if (_wallet == address(0) || !blacklistedWallets.contains(_wallet)) revert INVALID_WALLET();

        blacklistedWallets.remove(_wallet);

		emit RemoveBlacklistedWallet(_wallet);
	}

    /**
        @notice register wallet
        @param walletAddress Wallet address
     */
    function _registerWallet(address walletAddress) private {    
        if (walletAddress == address(0) ||
            registeredWallets.contains(walletAddress) ||
            blacklistedWallets.contains(walletAddress)
            ) revert INVALID_WALLET();

        uint256 balanceOfWallet = _getWalletBalance(walletAddress);

        if (balanceOfWallet == 0) revert INVALID_BALANCE();

        registeredWallets.add(walletAddress);

        emit AddRegisteredWallet(
            walletAddress
        );        
    }

    function _getWalletBalance(address walletAddress) private view returns (uint256) {  
        uint256 length = eligibleTokens.length();
        uint256 balanceOfWallet = 0;

        for (uint256 i = 0; i < length; i++) {
            address tokenAddress = eligibleTokens.at(i);
            balanceOfWallet += IERC20(tokenAddress).balanceOf(walletAddress);
        }

        uint256 FNFTbalance = fnft.balanceOf(walletAddress);

        return balanceOfWallet + FNFTbalance;
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

    /**
        @notice add eligible tokens
        @param _tokens  token address
     */
    function addEligibleTokens(address[] memory _tokens) external onlyRole(MODERATOR_ROLE) {
        _addEligibleTokens(_tokens);
	}

    /**
        @notice add blacklist wallet 
        @param _wallets  wallet address
     */
    function addBlacklistWallet(address[] memory _wallets) external onlyRole(MODERATOR_ROLE) {
        uint256 length = _wallets.length;

        for (uint256 i = 0; i < length; i++) {
            _addBlacklistWallet(_wallets[i]);
        }
	}

    /**
        @notice add blacklist wallet 
        @param _wallets  wallet address
     */
    function removeBlacklistWallet(address[] memory _wallets) external onlyRole(MODERATOR_ROLE) {
       uint256 length = _wallets.length;

        for (uint256 i = 0; i < length; i++) {
            _removeBlacklistWallet(_wallets[i]);
        }
	}

    /* ======== MODERATOR FUNCTIONS ======== */

    /**
        @notice register one wallet
        @param walletAddress Wallet address
     */
    function registerWallet(address walletAddress) external {         
        _registerWallet(walletAddress);
    }

    /**
        @notice register multiple wallets
        @param _wallets Wallet addresses
     */
    function registerWallets(address[] memory _wallets) external onlyRole(MODERATOR_ROLE) {    
         uint256 length = _wallets.length;

        for (uint256 i = 0; i < length; i++) {
            _registerWallet(_wallets[i]);
        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    /// @notice Returns the length of eligible tokens
	function getEligibleTokensCount() external view returns (uint256) {
		return eligibleTokens.length();
	}

    /// @notice Returns the length of registered wallets
	function getRegisteredWalletsCount() external view returns (uint256) {
		return registeredWallets.length();
	}

	/**
        @notice return if wallet is registered
        @param _walletAddress address
        @return bool
     */
	function isRegisteredWallet(address _walletAddress) external view returns (bool) {
		return registeredWallets.contains(_walletAddress);
	}

    /// @notice Returns wallet info
    function getTokensInWallet(address _walletAddress) external view returns (Token[] memory) {
        return tokensInWallet[_walletAddress];
    }

     /// @notice Returns all eligible tokens
    function getAllTokens() external view returns (address[] memory) {
        return eligibleTokens.values();
    }

     /// @notice Returns all wallet addresses
    function getAllWallets() external view returns (address[] memory) {
        return registeredWallets.values();
    }

     /// @notice Returns all wallet addresses from a range
    function getWalletsFromRange(uint16 fromIndex, uint16 toIndex) external view returns (address[] memory) {
        uint256 length = registeredWallets.length();
        if (fromIndex >= toIndex || toIndex > length) revert INVALID_PARAM();

        address[] memory _wallets = new address[](toIndex - fromIndex);
        uint256 index = 0;

        for (uint256 i = fromIndex; i < toIndex; i++) {
            _wallets[index] = registeredWallets.at(i);
            index++;
        }

        return _wallets;
    }

      /// @notice Returns wallet at index
    function getAllWalletAtIndex(uint16 index) external view returns (address) {
        return registeredWallets.at(index);
    }

    /// @notice Returns the length of registered wallets
	function getBlacklistCount() external view returns (uint256) {
		return blacklistedWallets.length();
	}

     /// @notice Returns all blacklisted wallet addresses
    function getAllBlacklistedWallets() external view returns (address[] memory) {
        return blacklistedWallets.values();
    }

    /**
        @notice return if wallet is blacklisted
        @param _walletAddress address
        @return bool
     */
	function isBlacklistedWallet(address _walletAddress) external view returns (bool) {
		return blacklistedWallets.contains(_walletAddress);
	}

     /// @notice Returns balance of eligible tokens from user's wallet
    function getBalancesFromWallet(address _walletAddress) external view returns (uint256) {
        return _getWalletBalance(_walletAddress);
    }

}
