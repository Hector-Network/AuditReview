// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IRegistrationWallet {
    struct Token {
        /// @notice token address
        address tokenAddress;
        /// @notice eligible amount eligible for redemption
        uint256 eligibleAmount;
        /// @notice  ineligible amount eligible for redemption
        uint256 ineligibleAmount;
        /// @notice token decimals
        uint8 decimals;
    }

    struct Wallet {
        /// @notice wallet address
        address walletAddress;
        /// @notice a wallet can have multiple tokens of type Token
        Token[] tokens;
    }
    function getAllTokens() external view returns (address[] memory);

    /// @notice Returns all wallet addresses    
    function getAllWallets() external view returns (address[] memory);

     /// @notice Returns all wallet addresses from a range
    function getWalletsFromRange(uint16 fromIndex, uint16 toIndex) external view returns (address[] memory);

      /// @notice Returns wallet at index
    function getAllWalletAtIndex(uint16 index) external view returns (address);

    /// @notice return if wallet is registered
    function isRegisteredWallet(address _walletAddress) external view returns (bool);
}
