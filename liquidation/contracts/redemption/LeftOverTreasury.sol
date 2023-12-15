// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/AccessControl.sol";
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '../interfaces/ITokenVault.sol';
import '../interfaces/IFNFT.sol';
import './LockAccessControl.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_WALLET();
error INVALID_BALANCE();
error INVALID_RECIPIENT();
error UNAUTHORIZED_RECIPIENT();
error UNAUTHORIZED_TOKEN();
error WALLET_ALREADY_RECEIVED_LEFTOVER();
error NO_WALLETS_TO_DISTRIBUTE();

contract LeftOverTreasury is
    LockAccessControl, 
    Pausable
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // @notice address wallets => received tokens
    mapping(address => uint256) public recipientTokens;

    // @notice list of wallets qualified to receive tokens
    EnumerableSet.AddressSet private eligibleWallets;

     // @notice list of wallets received leftover distribution
    EnumerableSet.AddressSet private leftoverWallets;

    /// @notice Deposited tokens set
    EnumerableSet.AddressSet private tokensSet;

    uint256 public amountPerWallet;

    event LeftOverDistributed(address indexed who, uint256 amount);

    /* ======= CONSTRUCTOR ======= */

    constructor(address _rewardToken, address provider) LockAccessControl(provider) {
        if (_rewardToken == address(0)) revert INVALID_ADDRESS();
        bool status = tokensSet.add(_rewardToken);

        amountPerWallet = 0;
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
        @notice Deposit token to treasury for leftover
        @param _amount  amount to deposit
     */
    function deposit(uint256 _amount) external whenNotPaused {
        if (_amount == 0) revert INVALID_AMOUNT();
        uint256 totalWallets = eligibleWallets.length();
        if (totalWallets == 0) revert NO_WALLETS_TO_DISTRIBUTE();

        address token = tokensSet.at(0);

        IERC20(token).approve(address(this), _amount);

        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);

        amountPerWallet = _amount / totalWallets;
    }

    /**
        @notice withdraw all tokens
     */    
    function withdrawAll() external onlyModerator {
        uint256 length = tokensSet.length();

        for (uint256 i = 0; i < length; i++) {
            address token = tokensSet.at(0);
            uint256 balance = IERC20(token).balanceOf(address(this));

            if (balance > 0) {
                IERC20(token).safeTransfer(owner(), balance);
            }
        }
    }
    

    /**
     * @notice Mint & Withdraw from one recipient
     * @param recipient The address to receive the rnft
     */
    function distributeLeftOverToWallet(address recipient) external
        onlyModerator
        whenNotPaused
    {

        _distributeLeftOverToWallet(recipient);
    }

    /**
     * @notice Send leftover to a list of recipients
     * @param recipients The address to receive the rnft
     */
    function distributeLeftOverToWallets(address[] memory recipients)  external
        whenNotPaused
        onlyModerator
    {
        uint256 totalRecipients = recipients.length;
        for (uint256 i = 0; i < totalRecipients; i++) {
            address recipient = recipients[i];
            _distributeLeftOverToWallet(recipient);
        }   
    }

    /**
        * @notice Mint & Withdraw from a recipient
        * @param recipient The address to receive the rnft
     */
    function _distributeLeftOverToWallet(address recipient)  internal
    {

        if (recipient == address(0)) revert INVALID_ADDRESS();
        if (!eligibleWallets.contains(recipient)) revert UNAUTHORIZED_RECIPIENT();
        if (leftoverWallets.contains(recipient)) revert WALLET_ALREADY_RECEIVED_LEFTOVER();

        recipientTokens[recipient] += amountPerWallet;

        bool status = leftoverWallets.add(recipient);

        if (!status) revert INVALID_WALLET();

        address token = tokensSet.at(0);
        if (token == address(0)) revert INVALID_ADDRESS();

        IERC20(token).safeTransferFrom(address(this), recipient, amountPerWallet);

        emit LeftOverDistributed(recipient, amountPerWallet);
    }

     /**
        @notice add wallet to eligibleWallets
        @param wallet Wallet address
     */
    function addEligibleWallet(address wallet) external onlyModerator {
        _addEligibleWallet(wallet);
    }

     /**
        @notice add wallet to leftover wallet
        @param wallet Wallet address
     */
    function addLeftOverWallet(address wallet) external onlyModerator {
        _addLeftOverWallet(wallet);
    }

    /**
        @notice add wallets to eligibleWallets
        @param wallets Wallet addresses
     */
    function addEligibleWallets(address[] memory wallets) external onlyModerator {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; i++) {
            address wallet = wallets[i];
            _addEligibleWallet(wallet);
        }
    }

    function _addEligibleWallet(address wallet) internal {
        if (wallet == address(0)) revert INVALID_ADDRESS();
        bool status;
        if (!eligibleWallets.contains(wallet)) 
            status = eligibleWallets.add(wallet);
    }

    function _addLeftOverWallet(address wallet) internal {
        if (wallet == address(0)) revert INVALID_ADDRESS();
        bool status;
        if (!leftoverWallets.contains(wallet)) 
            status = leftoverWallets.add(wallet);
    }

    /**
        @notice remove wallet from eligibleWallets
        @param wallet Wallet address
     */
    function removeEligibleWallet(address wallet) external onlyModerator {
        _removeEligibleWallet(wallet);
    }

     /**
        @notice remove wallet from leftover
        @param wallet Wallet address
     */
    function removeLeftOverWallet(address wallet) external onlyModerator {
        _removeLeftOverWallet(wallet);
    }

    /**
        @notice remove wallets from eligibleWallets
        @param wallets Wallet addresses
     */
    function removeEligibleWallets(address[] memory wallets) external onlyModerator {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; i++) {
            address wallet = wallets[i];
            _removeEligibleWallet(wallet);
        }        
    }

    function _removeEligibleWallet(address wallet) internal {
        if (wallet == address(0)) revert INVALID_ADDRESS();
        bool status;
        if (eligibleWallets.contains(wallet)) 
            status = eligibleWallets.remove(wallet);

    }

    function _removeLeftOverWallet(address wallet) internal {
        if (wallet == address(0)) revert INVALID_ADDRESS();
        bool status;
        if (leftoverWallets.contains(wallet)) 
            status = leftoverWallets.remove(wallet);

    }

    function updateAmountPerWallet(uint256 _amount) external onlyModerator {
        amountPerWallet = _amount;
    }

    ///////////////////////////////////////////////////////
    //                  VIEW FUNCTIONS                   //
    ///////////////////////////////////////////////////////


     /// @notice Returns the length of eligible wallets
	function getEligibleWalletsCount() external view returns (uint256) {
		return eligibleWallets.length();
	}

     /// @notice Returns the length of leftover wallets
	function getLeftOverWalletsCount() external view returns (uint256) {
		return leftoverWallets.length();
	}

    /// @notice Returns all eligible wallets
    function getAllEligibleWallets() external view returns (address[] memory) {
        return eligibleWallets.values();
    }

    /// @notice Returns all eligible wallets
    function getAllLeftOverWallets() external view returns (address[] memory) {
        return leftoverWallets.values();
    }

    /**
        @notice return if wallet is registered
        @param _walletAddress address
        @return bool
     */
	function isRegisteredWallet(address _walletAddress) external view returns (bool) {
		return eligibleWallets.contains(_walletAddress);
	}

    /**
        @notice return if wallet has received leftover
        @param _walletAddress address
        @return bool
     */
	function isLeftOverDistributed(address _walletAddress) external view returns (bool) {
		return leftoverWallets.contains(_walletAddress);
	}

    /// @notice Returns all wallet addresses from a range
    function getEligibleWalletsFromRange(uint16 fromIndex, uint16 toIndex) external view returns (address[] memory) {
        uint256 length = eligibleWallets.length();
        if (fromIndex >= toIndex || toIndex > length) revert INVALID_PARAM();

        address[] memory _wallets = new address[](toIndex - fromIndex);
        uint256 index = 0;

        for (uint256 i = fromIndex; i < toIndex; i++) {
            _wallets[index] = eligibleWallets.at(i);
            index++;
        }

        return _wallets;
    }

    /// @notice Returns wallet at index
    function getEligibleWalletAtIndex(uint16 index) external view returns (address) {
        return eligibleWallets.at(index);
    }
}
