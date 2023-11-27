// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface ILockAddressRegistry {
    function initialize(
        address admin,
        address moderator,
        address tokenVault,
        address fnft,
        address treasury,
        address redeemableToken
    ) external;

    function getAdmin() external view returns (address);

    function setAdmin(address admin) external;

    function getTokenVault() external view returns (address);

    function setTokenVault(address vault) external;

    function getFNFT() external view returns (address);

    function setFNFT(address fnft) external;

    function getTreasury() external view returns (address);

    function setTreasury(address fnft) external;

    function getRedeemToken() external view returns (address);

    function setRedeemToken(address token) external;

    function getAddress(bytes32 id) external view returns (address);

    function isModerator(address from) external view returns (bool);
}
