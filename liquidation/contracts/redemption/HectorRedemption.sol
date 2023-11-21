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
error EXISTING_FNFT();
error REDEMPTION_TIME_EXPIRES();


contract HectorRedemption is
    IRedemptionWallet,
    LockAccessControl, 
    IERC721Receiver,
    Pausable
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice Get whitelist tokens
    IRegistrationWallet public registrationWallet;

    address[] public eligibleTokens;
    uint256[] depositedFNFTs;
    address constant private  BURN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice A list of wallet addresses tracking who redeems tokens
    EnumerableSet.AddressSet private redeemedWallets;

    /// @notice A list of wallet addresses tracking who receives leftover after redemption
    EnumerableSet.AddressSet private leftOverDistributedWallets;


    /// @notice last day to claim
    uint256 public lastDayToClaim; 

    /* ======== EVENTS ======== */
    event DepositToken(address token, uint256 amount);
    event DepositFNFT(uint256 fnftId);
    event BurnToken(address token);
    event BurnFNFT(uint256 fnftId);
    event AddEligibleToken(address token);


    /* ======== INITIALIZATION ======== */

    constructor(address provider,  address _registrationWallet, uint256 _lastDayToClaim) LockAccessControl(provider) {
        if (_registrationWallet == address(0)) revert INVALID_ADDRESS();

        registrationWallet = IRegistrationWallet(_registrationWallet);

        if (_lastDayToClaim <= 0) revert INVALID_PARAM();

        lastDayToClaim = _lastDayToClaim;
    }

    /** 
        @notice add modifier to check if the current time is less than the last day to claim
    */
    modifier isRedemptionTime() {
        if (block.timestamp > lastDayToClaim) revert REDEMPTION_TIME_EXPIRES();
        _;
    }
    

    /* ======== PRIVATE ======== */
   

    /* ======== POLICY FUNCTIONS ======== */

    function pause() external onlyModerator whenNotPaused {
        return _pause();
    }

    function unpause() external onlyModerator whenPaused {
        return _unpause();
    }

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
    function deposit(address token, uint256 amount) external isRedemptionTime whenNotPaused {         
        if (amount <= 0) revert INVALID_AMOUNT();
        if (!registrationWallet.isRegisteredToken(token)) revert INVALID_PARAM();
        if (!registrationWallet.isRegisteredWallet(msg.sender)) revert INVALID_WALLET();

        if (!redeemedWallets.contains(msg.sender)) 
            redeemedWallets.add(msg.sender);

        //get whitelist token
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit DepositToken(token, amount);
    }

    /**
        @notice deposit a list of FNFT to the contract
        @param fnftIds Wallet address
     */
    function depositFNFTs(uint256[] memory fnftIds) external isRedemptionTime whenNotPaused {  
        if (fnftIds.length <= 0) revert INVALID_PARAM();
               
        uint256 length = fnftIds.length;

        if (!redeemedWallets.contains(msg.sender)) 
            redeemedWallets.add(msg.sender);

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
        eligibleTokens = registrationWallet.getAllTokens();   
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

    /**
        @notice keeps track of wallets receving leftover from treasury
        @param wallet Wallet address
     */
    function addLeftOverWallet(address wallet) external onlyModerator {
        if (wallet == address(0)) revert INVALID_ADDRESS();
        if (!leftOverDistributedWallets.contains(wallet)) 
            leftOverDistributedWallets.add(wallet);
    }

    /**
        @notice remove wallet from leftOverDistributedWallets
        @param wallet Wallet address
     */
    function removeLeftOverWallet(address wallet) external onlyModerator {
        if (wallet == address(0)) revert INVALID_ADDRESS();
        if (leftOverDistributedWallets.contains(wallet)) 
            leftOverDistributedWallets.remove(wallet);

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

      /// @notice Returns all redeemed wallet addresses
    function getAllRedeemedWallets() external view returns (address[] memory) {
        return redeemedWallets.values();
    }

      /// @notice Returns all leftover wallet addresses
    function getAllLeftoverWallets() external view returns (address[] memory) {
        return leftOverDistributedWallets.values();
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

     /// @notice Returns all leftover wallet addresses from a range
    function getLeftOverWalletsFromRange(uint16 fromIndex, uint16 toIndex) external view returns (address[] memory) {
        uint256 length = leftOverDistributedWallets.length();
        if (fromIndex >= toIndex || toIndex > length) revert INVALID_PARAM();

        address[] memory _wallets = new address[](toIndex - fromIndex);
        uint256 index = 0;

        for (uint256 i = fromIndex; i < toIndex; i++) {
            _wallets[index] = leftOverDistributedWallets.at(i);
            index++;
        }

        return _wallets;
    }

    /// @notice Returns redeemed wallet at index
    function getRedeemedWalletAtIndex(uint16 index) external view returns (address) {
        return redeemedWallets.at(index);
    }

    /// @notice Returns leftover wallet at index
    function getLeftOverWalletAtIndex(uint16 index) external view returns (address) {
        return leftOverDistributedWallets.at(index);
    }

    /// @notice Returns the count of redeemed wallets
	function getRedeemedWalletsCount() external view returns (uint256) {
		return redeemedWallets.length();
	}

    /// @notice Returns the count of leftover wallets
	function getLeftOverWalletsCount() external view returns (uint256) {
		return leftOverDistributedWallets.length();
	}

    /**
        @notice return if wallet has redeemed
        @param _walletAddress address
        @return bool
     */
	function isRedeemedWallet(address _walletAddress) external view returns (bool) {
		return redeemedWallets.contains(_walletAddress);
	}


    /**
        @notice return if wallet belongs to a leftover list
        @param _walletAddress address
        @return bool
     */
    function isLeftOverWallet(address _walletAddress) external view returns (bool) {
		return leftOverDistributedWallets.contains(_walletAddress);
	}

}
