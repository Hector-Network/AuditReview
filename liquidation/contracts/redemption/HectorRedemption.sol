// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import '@openzeppelin/contracts/security/Pausable.sol';

import '../interfaces/IFNFT.sol';
import './LockAccessControl.sol';

import {IRedemptionWallet} from '../interfaces/IRedemptionWallet.sol';
import {IRegistrationWallet} from '../interfaces/IRegistrationWallet.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_TIME();
error INVALID_WALLET();
error INVALID_BALANCE();
error REDEMPTION_TIME_EXPIRES();
error UNAUTHORIZED_RECIPIENT();

contract HectorRedemption is
    IRedemptionWallet,
    LockAccessControl, 
    Pausable
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice Get whitelist tokens
    IRegistrationWallet public registrationWallet;
    EnumerableSet.AddressSet private eligibleTokens;

    //address[] public eligibleTokens;
    address constant private  BURN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice A list of wallet addresses tracking who redeems tokens
    EnumerableSet.AddressSet private redeemedWallets;

    /// @notice last day to claim
    uint256 public lastDayToClaim; 

    /* ======== EVENTS ======== */
    event DepositToken(address token, uint256 amount);
    event BurnToken(address token);
    event AddEligibleToken(address token);
    event RemoveEligibleToken(address token);


    /* ======== INITIALIZATION ======== */

    constructor(address provider,  address _registrationWallet, uint256 _lastDayToClaim, address[] memory _tokens) LockAccessControl(provider) {
        if (_registrationWallet == address(0)) revert INVALID_ADDRESS();

        registrationWallet = IRegistrationWallet(_registrationWallet);

        if (_lastDayToClaim <= 0) revert INVALID_PARAM();

        lastDayToClaim = _lastDayToClaim;

        _addEligibleTokens(_tokens);
    }

    /** 
        @notice add modifier to check if the current time is less than the last day to claim
    */
    modifier isRedemptionTime() {
        if (block.timestamp > lastDayToClaim) revert REDEMPTION_TIME_EXPIRES();
        _;
    }
    

    /* ======== PRIVATE ======== */
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
        @notice remove eligible wallet 
        @param _token  wallet address
     */
    function _removeEligibleToken(address _token) private {
        //check for duplicate
        if (_token == address(0) || !eligibleTokens.contains(_token)) revert INVALID_PARAM();

        eligibleTokens.remove(_token);

		emit RemoveEligibleToken(_token);
	}
   

    /* ======== POLICY FUNCTIONS ======== */

    function pause() external onlyModerator whenNotPaused {
        return _pause();
    }

    function unpause() external onlyModerator whenPaused {
        return _unpause();
    }

    /* ======== MODERATOR FUNCTIONS ======== */

    /**
        @notice deposit erc20 tokens to the contract
        @param token Wallet address
        @param amount deposit amount
     */
    function deposit(address token, uint256 amount) external isRedemptionTime whenNotPaused {         
        if (amount <= 0) revert INVALID_AMOUNT();
        if (!eligibleTokens.contains(token)) revert INVALID_PARAM();
        if (!registrationWallet.isRegisteredWallet(msg.sender)) revert UNAUTHORIZED_RECIPIENT();

        if (!redeemedWallets.contains(msg.sender)) 
            redeemedWallets.add(msg.sender);

        //get whitelist token
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit DepositToken(token, amount);
    }

    /**
        @notice burn all tokens from contract
     */
    function burnTokens() external onlyModerator { 
        uint256 length = eligibleTokens.length();

        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens.at(i);
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) 
                IERC20(token).safeTransfer(BURN_ADDRESS, balance);

            emit BurnToken(token);
        }
    }

    /**
        @notice withdraw all tokens
     */    
    function withdrawAllTokens() external onlyModerator {
        uint256 length = eligibleTokens.length();

        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens.at(i);
            uint256 balance = IERC20(token).balanceOf(address(this));

            if (balance > 0) {
                IERC20(token).safeTransfer(owner(), balance);
            }        
        }
    }

    /**
        @notice update last day to claim
        @param _lastDayToClaim new value
     */
    function updateLastDayToClaim(uint256 _lastDayToClaim) external onlyModerator {
        if (_lastDayToClaim <= 0) revert INVALID_PARAM();

        lastDayToClaim = _lastDayToClaim;
    }

    /**
        @notice update registration contract
        @param _registrationWallet new contract address
     */
    function updateRegistrationContract(address _registrationWallet) external onlyModerator {
        if (_registrationWallet == address(0)) revert INVALID_ADDRESS();

        registrationWallet = IRegistrationWallet(_registrationWallet);
    }

    /**
        @notice add eligible tokens
        @param _tokens  token address
     */
    function addEligibleTokens(address[] memory _tokens) external onlyModerator {
        _addEligibleTokens(_tokens);
	}

    /**
        @notice remove eligible token
        @param _token  token address
     */
    function removeEligibleToken(address _token) external onlyModerator {
        _removeEligibleToken(_token);
	}

    /* ======== VIEW FUNCTIONS ======== */

    /// @notice Returns an array of eligible tokens and its balance
    function getTotalBalance() external view returns (TokenBalance[] memory) {
        TokenBalance[] memory tokenBalances;

        uint256 length = eligibleTokens.length();
        
        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens.at(i);
            uint256 balance = IERC20(token).balanceOf(address(this));
            tokenBalances[i] = TokenBalance(token, balance);
        }

        return tokenBalances;
    }

      /// @notice Returns all redeemed wallet addresses
    function getAllRedeemedWallets() external view returns (address[] memory) {
        return redeemedWallets.values();
    }

     /// @notice Returns all redeemed wallet addresses from a range
    function getRedeemedWalletsFromRange(uint16 fromIndex, uint16 toIndex) external view returns (address[] memory) {
        uint256 length = redeemedWallets.length();
        if (fromIndex >= toIndex || toIndex > length) revert INVALID_PARAM();

        address[] memory _wallets = new address[](toIndex - fromIndex);
        uint256 index = 0;

        for (uint256 i = fromIndex; i < toIndex; i++) {
            _wallets[index] = redeemedWallets.at(i);
            index++;
        }

        return _wallets;
    }

    /// @notice Returns redeemed wallet at index
    function getRedeemedWalletAtIndex(uint16 index) external view returns (address) {
        return redeemedWallets.at(index);
    }

    /// @notice Returns the count of redeemed wallets
	function getRedeemedWalletsCount() external view returns (uint256) {
		return redeemedWallets.length();
	}

    /**
        @notice return if wallet has redeemed
        @param _walletAddress address
        @return bool
     */
	function isRedeemedWallet(address _walletAddress) external view returns (bool) {
		return redeemedWallets.contains(_walletAddress);
	}

    /// @notice Returns the length of eligible tokens
	function getEligibleTokensCount() external view returns (uint256) {
		return eligibleTokens.length();
	}

    /// @notice Returns all eligible tokens
    function getAllTokens() external view returns (address[] memory) {
        return eligibleTokens.values();
    }

    /**
        @notice return if token is registered
        @param _tokenAddress address
        @return bool
     */
	function isRegisteredToken(address _tokenAddress) external view returns (bool) {
		return eligibleTokens.contains(_tokenAddress);
	}

}
