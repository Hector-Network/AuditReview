// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";
import '../interfaces/IFNFT.sol';

import {IRedemptionWallet} from '../interfaces/IRedemptionWallet.sol';
import {IRegistrationWallet} from '../interfaces/IRegistrationWallet.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_TIME();
error INVALID_WALLET();
error INVALID_BALANCE();
error EXISTING_FNFT();


contract HectorRedemption is
    IRedemptionWallet,
    Ownable,
    AccessControl
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice Get whitelist tokens
    IRegistrationWallet public registrationWallet;

    EnumerableSet.AddressSet private eligibleTokens;
    uint256[] depositedFNFTs;

    /// @notice setup moderator role
    bytes32 public constant MODERATOR_ROLE = keccak256('MODERATOR_ROLE');

    /// @notice Hector fnft contract 
    //IFNFT public fnft = IFNFT(0x51aEafAC5E4494E9bB2B9e5176844206AaC33Aa3); 
    IFNFT public fnft;  //TODO: change to mainnet address

    /* ======== EVENTS ======== */
    event SetModerator(address _moderator, bool _approved);
    event DepositToken(address token, uint256 amount);
    event DepositFNFT(uint256 fnftId);
    event BurnToken(address token);
    event BurnFNFT(uint256 fnftId);
    event AddEligibleToken(address token);


    /* ======== INITIALIZATION ======== */

    constructor(address multisigWallet, address moderator, address _registrationWallet, address _fnft) {
        if (multisigWallet == address(0)) revert INVALID_ADDRESS();
        if (moderator == address(0)) revert INVALID_ADDRESS();
        if (_registrationWallet == address(0)) revert INVALID_ADDRESS();

        fnft = IFNFT(_fnft);

        registrationWallet = IRegistrationWallet(_registrationWallet);
        address[] memory _tokens = registrationWallet.getAllTokens();

        _convertArrayToEnumerableSet(_tokens);

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


    function _convertArrayToEnumerableSet(address[] memory _tokens) private {
        uint256 length = _tokens.length;

        for (uint256 i = 0; i < length; i++) {
            eligibleTokens.add(_tokens[i]);
        }
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

    
    /* ======== MODERATOR FUNCTIONS ======== */

    /**
        @notice deposit erc20 tokens to the contract
        @param token Wallet address
        @param amount deposit amount
     */
    function deposit(address token, uint256 amount) external {         
        if (amount <= 0) revert INVALID_AMOUNT();
        if (!eligibleTokens.contains(token)) revert INVALID_PARAM();
        if (!registrationWallet.isRegisteredWallet(msg.sender)) revert INVALID_WALLET();

        //get whitelist token
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit DepositToken(token, amount);
    }

    /**
        @notice deposit a list of FNFT to the contract
        @param fnftIds Wallet address
     */
    function depositFNFTs(uint256[] memory fnftIds) external {  
        if (fnftIds.length <= 0) revert INVALID_PARAM();
               
        uint256 length = fnftIds.length;

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = fnftIds[i];
            if (fnft.ownerOf(tokenId) != msg.sender) revert INVALID_WALLET();

            fnft.safeTransferFrom(msg.sender, address(this), tokenId);
            depositedFNFTs.push(tokenId);
            emit DepositFNFT(tokenId);
        }
    }

    /**
        @notice burn all tokens from contract
     */
    function burnTokens() external onlyRole(MODERATOR_ROLE) {    
        uint256 length = eligibleTokens.length();

        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens.at(i);
            uint256 balance = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(address(0), balance);

            emit BurnToken(token);
        }
    }

    /**
        @notice burn all FNFTs from depositedFNFTs 
     */
    function burnFNFTs() external onlyRole(MODERATOR_ROLE) {            
        uint256 length = depositedFNFTs.length;

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = depositedFNFTs[i];
            fnft.safeTransferFrom(address(this), address(0), tokenId);

            emit BurnFNFT(tokenId);
        }
    }

    /**
        @notice withdraw all tokens
     */    
    function withdrawAllTokens() external onlyRole(MODERATOR_ROLE) {
        uint256 length = eligibleTokens.length();

        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens.at(0);
            uint256 balance = IERC20(token).balanceOf(address(this));

            if (balance > 0) {
                IERC20(token).safeTransfer(owner(), balance);
            }

            eligibleTokens.remove(token);
        }
    }

     /**
        @notice withdraw all tokens
     */ 
    function withdrawAllFNFTs() external onlyRole(MODERATOR_ROLE) {
        uint256 length = depositedFNFTs.length;

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = depositedFNFTs[i];
            fnft.safeTransferFrom(address(this), owner(), tokenId);
            depositedFNFTs[i] = depositedFNFTs[depositedFNFTs.length - 1];
            depositedFNFTs.pop();        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    /// @notice Returns all eligible tokens
    function getAllTokens() external view returns (address[] memory) {
        return eligibleTokens.values();
    }

    /// @notice Returns the length of eligible tokens
	function getDepositedFNFTCount() external view returns (uint256) {
		return depositedFNFTs.length;
	}

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

}
