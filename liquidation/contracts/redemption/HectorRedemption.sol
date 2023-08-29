// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

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
error EXISTING_FNFT();


contract HectorRedemption is
    IRedemptionWallet,
    LockAccessControl, 
    IERC721Receiver
{
    using SafeERC20 for IERC20;

    /* ======== STORAGE ======== */

    /// @notice Get whitelist tokens
    IRegistrationWallet public registrationWallet;

    address[] public eligibleTokens;
    uint256[] depositedFNFTs;
    address constant private  BURN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice Hector fnft contract 
    //IFNFT public fnft = IFNFT(0x51aEafAC5E4494E9bB2B9e5176844206AaC33Aa3); 

    /* ======== EVENTS ======== */
    event DepositToken(address token, uint256 amount);
    event DepositFNFT(uint256 fnftId);
    event BurnToken(address token);
    event BurnFNFT(uint256 fnftId);
    event AddEligibleToken(address token);


    /* ======== INITIALIZATION ======== */

    constructor(address provider,  address _registrationWallet) LockAccessControl(provider) {
        if (_registrationWallet == address(0)) revert INVALID_ADDRESS();

        registrationWallet = IRegistrationWallet(_registrationWallet);
        eligibleTokens = registrationWallet.getAllTokens();
    }

    /* ======== PRIVATE ======== */
   

    /* ======== POLICY FUNCTIONS ======== */

    function onERC721Received(address operator, address from, uint256 tokenId, bytes memory data) public returns (bytes4) {
        // Handle the incoming ERC721 token here
        // Return the expected magic value if the transfer is successful
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    /* ======== MODERATOR FUNCTIONS ======== */

    /**
        @notice deposit erc20 tokens to the contract
        @param token Wallet address
        @param amount deposit amount
     */
    function deposit(address token, uint256 amount) external {         
        if (amount <= 0) revert INVALID_AMOUNT();
        if (!registrationWallet.isRegisteredToken(token)) revert INVALID_PARAM();
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
            if (getFNFT().ownerOf(tokenId) != msg.sender) revert INVALID_WALLET();

            getFNFT().safeTransferFrom(msg.sender, address(this), tokenId);
            depositedFNFTs.push(tokenId);
            emit DepositFNFT(tokenId);
        }
    }

    /**
        @notice burn all tokens from contract
     */
    function burnTokens() external onlyModerator {    
        uint256 length = eligibleTokens.length;

        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(BURN_ADDRESS, balance);

            emit BurnToken(token);
        }
    }

    /**
        @notice burn all FNFTs from depositedFNFTs 
     */
    function burnFNFTs() external onlyModerator {            
        uint256 length = depositedFNFTs.length;

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = depositedFNFTs[i];
            getFNFT().burn(tokenId);

            emit BurnFNFT(tokenId);
        }
    }

    /**
        @notice withdraw all tokens
     */    
    function withdrawAllTokens() external onlyModerator {
        uint256 length = eligibleTokens.length;

        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));

            if (balance > 0) {
                IERC20(token).safeTransfer(owner(), balance);
            }

            delete eligibleTokens[i];
        }
    }

     /**
        @notice withdraw all tokens
     */ 
    function withdrawAllFNFTs() external onlyModerator {
        uint256 length = depositedFNFTs.length;

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = depositedFNFTs[i];
            getFNFT().safeTransferFrom(address(this), owner(), tokenId);
            depositedFNFTs[i] = depositedFNFTs[depositedFNFTs.length - 1];
            depositedFNFTs.pop();        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    /// @notice Returns the length of eligible tokens
	function getDepositedFNFTCount() external view returns (uint256) {
		return depositedFNFTs.length;
	}

    /// @notice Returns an array of eligible tokens and its balance
    function getTotalBalance() external view returns (TokenBalance[] memory) {
        TokenBalance[] memory tokenBalances;

        uint256 length = eligibleTokens.length;
        
        for (uint256 i = 0; i < length; i++) {
            address token = eligibleTokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            tokenBalances[i] = TokenBalance(token, balance);
        }

        return tokenBalances;
    }

}
