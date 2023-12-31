// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IRedemptionWallet {
    struct TokenBalance {
        /// @notice token address
        address token;
        /// @notice token balance
        uint256 balance;
    }
    
}
