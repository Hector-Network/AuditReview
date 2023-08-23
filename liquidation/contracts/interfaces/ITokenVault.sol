// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

interface ITokenVault {
    event RedeemNFTMinted(
        address indexed from,
        uint256 indexed fnftId,
        uint256 eligibleTORAmount,
        uint256 eligibleHECAmount, 
        uint256 redeemableAmount
    );

    event RedeemNFTWithdrawn(
        address indexed from,
        uint256 indexed fnftId,
        uint256 indexed quantity
    );

    struct InputToken {
        address tokenAddress;
        uint256 amount;
    }
    struct FNFTConfig {
        uint256 eligibleTORAmount; // The amount of TOR tokens exchanged from user's tokens
        uint256 eligibleHECAmount; // The amount of HEC tokens exchanged from user's tokens
        InputToken[] inputTokens; // The tokens that the user is depositing
        address redeemableToken; // The token that the user is redeeming
        uint256 redeemableAmount; // The amount of HEC tokens exchanged from user's tokens        
    }

    function getFNFT(uint256 fnftId) external view returns (FNFTConfig memory);

    function mint(address recipient, FNFTConfig memory fnftConfig)
        external
        returns (uint256);

    function withdraw(address recipient, uint256 fnftId) external;
}
