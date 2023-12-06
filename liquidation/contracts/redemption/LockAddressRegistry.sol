// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import '../interfaces/ILockAddressRegistry.sol';
import '../interfaces/IFNFT.sol';
import '../interfaces/IRedemptionTreasury.sol';
import '../interfaces/ITokenVault.sol';

error INVALID_ADDRESS();

contract LockAddressRegistry is AccessControlEnumerable, Ownable, ILockAddressRegistry {

    bytes32 public constant ADMIN = 'ADMIN';
    bytes32 public constant MULTISIG = 'MULTISIG';
    bytes32 public constant TOKEN_VAULT = 'TOKEN_VAULT';
    bytes32 public constant RNFT = 'RNFT';
    bytes32 public constant TREASURY = 'TREASURY';
    bytes32 public constant REDEEMABLE_TOKEN = 'REDEEMABLE_TOKEN';

    bytes32 public constant MODERATOR_ROLE = keccak256('MODERATOR_ROLE');

    mapping(bytes32 => address) private _addresses;

    event SetModerator(address _moderator, bool _approved);

    constructor() Ownable() {}

    // Set up all addresses for the registry.
    function initialize(
        address multisigWallet,
        address moderator,
        address tokenVault,
        address rnft,
        address treasury,
        address redeemableToken
    ) external override onlyOwner {
        if (multisigWallet == address(0)) revert INVALID_ADDRESS();
        if (tokenVault == address(0)) revert INVALID_ADDRESS();
        if (rnft == address(0)) revert INVALID_ADDRESS();
        if (treasury == address(0)) revert INVALID_ADDRESS();
        if (moderator == address(0)) revert INVALID_ADDRESS();
        if (redeemableToken == address(0)) revert INVALID_ADDRESS();

        _addresses[MULTISIG] = multisigWallet;
        _addresses[TOKEN_VAULT] = tokenVault;
        _addresses[RNFT] = rnft;
        _addresses[TREASURY] = treasury;
        _addresses[REDEEMABLE_TOKEN] = redeemableToken;

        _transferOwnership(multisigWallet);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MODERATOR_ROLE, msg.sender);
        _setupRole(MODERATOR_ROLE, moderator);
    }

    function getMultiSigWallet() external view override returns (address) {
        return _addresses[MULTISIG];
    }

    function setMultiSigWallet(address _multisig) external override onlyOwner {
        _addresses[MULTISIG] = _multisig;
    }

    function getTokenVault() external view override returns (address) {
        return getAddress(TOKEN_VAULT);
    }

    function setTokenVault(address vault) external override onlyOwner {
        _addresses[TOKEN_VAULT] = vault;
    }

    function getRNFT() external view override returns (address) {
        return _addresses[RNFT];
    }

    function setRNFT(address rnft) external override onlyOwner {
        _addresses[RNFT] = rnft;
    }

    function getTreasury() external view override returns (address) {
        return _addresses[TREASURY];
    }

    function setTreasury(address _treasury) external override onlyOwner {
        _addresses[TREASURY] = _treasury;
    }

    function getRedeemToken() external view override returns (address) {
        return _addresses[REDEEMABLE_TOKEN];
    }

    function setRedeemToken(address redeemableToken) external override onlyOwner {
        _addresses[REDEEMABLE_TOKEN] = redeemableToken;
    }

    /**
     * @dev Returns an address by id
     * @return The address
     */
    function getAddress(bytes32 id) public view override returns (address) {
        return _addresses[id];
    }

    function isModerator(address from) public view override returns (bool) {
        return hasRole(MODERATOR_ROLE, from);
    }

     /* ======== POLICY FUNCTIONS ======== */

    /**
        @notice add moderator 
        @param _moderator new/existing wallet address
		@param _approved active/inactive flag
     */
    function setModerator(address _moderator, bool _approved) external onlyRole(MODERATOR_ROLE) {
		if (_moderator == address(0)) revert INVALID_ADDRESS();
		if (_approved) grantRole(MODERATOR_ROLE, _moderator);
		else revokeRole(MODERATOR_ROLE, _moderator);
		emit SetModerator(_moderator, _approved);
	}
}
