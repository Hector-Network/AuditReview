// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_DAO_FEE();
error INVALID_FEES();
error INVALID_TRANSFER_ETH();
error DAO_FEE_FAILED();
error MUST_QUEUE();
error QUEUE_NOT_EXPIRED();
error INVALID_MODERATOR();

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is OwnableUpgradeable, PausableUpgradeable {
	using SafeERC20Upgradeable for IERC20Upgradeable;
	// Struct Asset Info
	struct SendingAssetInfo {
		bytes callData;
		uint256 sendingAmount;
		uint256 totalAmount;
		uint256 feeAmount;
		uint256 bridgeFee;
	}

	// State variables
	uint256 public CountDest; // Count of the destination wallets
	uint256 public minFeePercentage;
	address public DAO; // DAO wallet for taking fee
	string public version;

	enum MANAGING {
		RESERVE_BRIDGES,
		RESERVE_BRIDGE_ASSETS
	}
	uint256 public blocksNeededForQueue;
	uint256 public constant MINQUEUETIME = 28800; // 8 hours

	address[] public reserveBridges;
	mapping(address => bool) public isReserveBridge;
	mapping(address => uint) public reserveBridgeQueue; // Delays changes to mapping.

	address[] public reserveBridgeAssets;
	mapping(address => bool) public isReserveBridgeAsset;
	mapping(address => uint) public reserveBridgeAssetQueue; // Delays changes to mapping.

	/// @notice moderators data
	mapping(address => bool) public moderators;

	// Events
	event SetCountDest(uint256 oldCountDest, uint256 newCountDest, address indexed user);
	event SetDAO(address oldDAO, address newDAO, address indexed user);
	event MakeCallData(bool success, bytes callData, address indexed user);
	event HectorBridge(address indexed user, SendingAssetInfo[] sendingAssetInfos);
	event SetVersion(string _version);
	event SetMinFeePercentage(uint256 feePercentage);
	event AddCallAddress(address _callAddress, address _owner);
	event RemoveCallAddress(address _callAddress, address _owner);
	event ApproveToken(address _srcToken, address _callAddress, uint256 _amount);

	event ChangeQueued(MANAGING indexed managing, address queued);
	event ChangeActivated(MANAGING indexed managing, address activated, bool result);
	event SetBlockQueue(uint256 oldBlockQueue, uint256 newBlockQueue);

	/* ======== INITIALIZATION ======== */

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	/**
	 * @dev sets initials
	 */
	function initialize(uint256 _CountDest, uint256 _blocksNeededForQueue) external initializer {
		if (_CountDest == 0) revert INVALID_PARAM();
		// if (_blocksNeededForQueue == 0 || _blocksNeededForQueue < MINQUEUETIME) revert INVALID_PARAM();

		CountDest = _CountDest;
		blocksNeededForQueue = _blocksNeededForQueue;
		minFeePercentage = 1;
		__Pausable_init();
		__Ownable_init();

		//Initialize moderator
		moderators[owner()] = true;
	}

	/* ======== MODIFIER ======== */

	modifier onlyMod() {
		if (!moderators[msg.sender]) revert INVALID_MODERATOR();
		_;
	}

	/* ======== VIEW FUNCTIONS ======== */
	/// @notice Returns the length of reserveBridges array
	function getReserveBridgesCount() external view returns (uint256) {
		return reserveBridges.length;
	}

	/// @notice Returns the length of reserveBridgeAssets array
	function getReserveBridgeAssetsCount() external view returns (uint256) {
		return reserveBridgeAssets.length;
	}

	/* ======== POLICY FUNCTIONS ======== */

	function pause() external onlyOwner {
		_pause();
	}

	function unpause() external onlyOwner {
		_unpause();
	}

	///////////////////////////////////////////////////////
	//               USER CALLED FUNCTIONS               //
	///////////////////////////////////////////////////////

	/// @notice Performs ERC20 token swap before bridging via HECTOR Bridge Splitter
	/// @param sendingAsset Asset that is used for bridge
	/// @param sendingAssetInfos Array Data used purely for sending assets
	/// @param callTargetAddress use in executing squid bridge contract
	function bridge(
		address sendingAsset,
		SendingAssetInfo[] calldata sendingAssetInfos,
		address callTargetAddress
	) external payable whenNotPaused {
		require(
			sendingAssetInfos.length > 0 &&
				sendingAssetInfos.length <= CountDest &&
				isReserveBridge[callTargetAddress] &&
				isReserveBridgeAsset[sendingAsset],
			'Bridge: Invalid parameters'
		);

		// Receive asset
		_receiveAssets(sendingAsset, sendingAssetInfos, callTargetAddress);

		uint length = sendingAssetInfos.length;
		for (uint i = 0; i < length; i++) {
			bytes memory callData = sendingAssetInfos[i].callData;
			uint256 fee = sendingAssetInfos[i].bridgeFee;
			if (fee > 0) {
				(bool success, bytes memory result) = payable(callTargetAddress).call{value: fee}(callData);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			} else {
				(bool success, bytes memory result) = payable(callTargetAddress).call(callData);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			}
		}
		emit HectorBridge(msg.sender, sendingAssetInfos);
	}

	///////////////////////////////////////////////////////
	//               USER CALLED FUNCTIONS               //
	///////////////////////////////////////////////////////

	/// @notice Performs Native token swap before bridging via HECTOR Bridge Splitter
	/// @param sendingAssetInfos Array Data used purely for sending assets
	/// @param callTargetAddress use in executing squid bridge contract
	function bridgeNative(
		SendingAssetInfo[] calldata sendingAssetInfos,
		address callTargetAddress
	) external payable whenNotPaused {
		require(
			sendingAssetInfos.length > 0 &&
				sendingAssetInfos.length <= CountDest &&
				isReserveBridge[callTargetAddress],
			'Bridge: Invalid parameters'
		);

		// Receive asset
		_receiveAssets(address(0), sendingAssetInfos, callTargetAddress);

		uint length = sendingAssetInfos.length;
		for (uint i = 0; i < length; i++) {
			bytes memory callData = sendingAssetInfos[i].callData;
			uint256 fee = sendingAssetInfos[i].bridgeFee;
			if (fee > 0) {
				(bool success, bytes memory result) = payable(callTargetAddress).call{value: fee}(callData);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			} else {
				(bool success, bytes memory result) = payable(callTargetAddress).call(callData);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			}
		}
		emit HectorBridge(msg.sender, sendingAssetInfos);
	}

	/**
        @notice receive assets to bridge
        @param sendingAsset sending asset contract address
		@param sendingAssetInfos sending asset info
		@param callTargetAddress target address
     */
	function _receiveAssets(
		address sendingAsset,
		SendingAssetInfo[] calldata sendingAssetInfos,
		address callTargetAddress
	) internal {
		uint256 totalAmounts = 0;
		uint256 sendAmounts = 0;
		uint256 feeAmounts = 0;
		uint256 bridgeFees = 0;
		for (uint i = 0; i < sendingAssetInfos.length; i++) {
			SendingAssetInfo memory sendingAssetInfo = sendingAssetInfos[i];
			uint256 totalAmount = sendingAssetInfo.totalAmount;
			uint256 sendingAmount = sendingAssetInfo.sendingAmount;
			uint256 feeAmount = sendingAssetInfo.feeAmount;
			uint256 bridgeFee = sendingAssetInfo.bridgeFee;

			require(totalAmount == sendingAmount + feeAmount, 'Bridge: Invalid asset info');

			if (feeAmount < (totalAmount * minFeePercentage) / 1000) revert INVALID_DAO_FEE();

			totalAmounts += totalAmount;
			sendAmounts += sendingAmount;
			feeAmounts += feeAmount;
			bridgeFees += bridgeFee;
		}

		if (sendingAsset != address(0)) {
			if (msg.value < bridgeFees) revert INVALID_FEES();
			IERC20Upgradeable srcToken = IERC20Upgradeable(sendingAsset);
			uint256 beforeBalance = srcToken.balanceOf(address(this));
			srcToken.safeTransferFrom(msg.sender, address(this), totalAmounts);
			uint256 afterBalance = srcToken.balanceOf(address(this));
			if (afterBalance - beforeBalance != totalAmounts) revert INVALID_AMOUNT();
			// Approve targetAddress
			require(srcToken.approve(callTargetAddress, sendAmounts), 'Approve Error');
			// Take Fee
			srcToken.safeTransfer(DAO, feeAmounts);
		} else {
			if (msg.value < bridgeFees + totalAmounts) revert INVALID_FEES();
			(bool success, ) = payable(DAO).call{value: feeAmounts}('');
			if (!success) revert DAO_FEE_FAILED();
		}
	}

	/// @notice Return revert msg of failed Bridge transaction
	function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
		// If the _res length is less than 68, then the transaction failed silently (without a revert message)
		if (_returnData.length < 68) return 'Transaction reverted silently';

		assembly {
			// Slice the sighash.
			_returnData := add(_returnData, 0x04)
		}
		return abi.decode(_returnData, (string)); // All that remains is the revert string
	}

	/**
        @notice set how many bridges the contract can process
        @param _countDest new count dest
     */
	function setCountDest(uint256 _countDest) external onlyOwner {
		if (_countDest == 0) revert INVALID_PARAM();
		uint256 oldCountDest = CountDest;
		CountDest = _countDest;
		emit SetCountDest(oldCountDest, _countDest, msg.sender);
	}

	/**
        @notice set DAO address
        @param newDAO new DAO address
     */
	function setDAO(address newDAO) external onlyOwner {
		if (newDAO == address(0)) revert INVALID_ADDRESS();
		address oldDAO = DAO;

		DAO = newDAO;
		emit SetDAO(oldDAO, newDAO, msg.sender);
	}

	/**
        @notice set version
        @param _version new version
     */
	function setVersion(string calldata _version) external onlyOwner {
		version = _version;
		emit SetVersion(_version);
	}

	/**
        @notice set Block Queue 
        @param _blocksNeededForQueue new queue block
     */
	function setBlockQueue(uint256 _blocksNeededForQueue) external onlyOwner {
		if (_blocksNeededForQueue == 0 || _blocksNeededForQueue < MINQUEUETIME) revert INVALID_PARAM();
		uint256 oldValue = blocksNeededForQueue;
		blocksNeededForQueue = _blocksNeededForQueue;

		emit SetBlockQueue(oldValue, _blocksNeededForQueue);
	}

	/**
        @notice set Minimum free percentage 
        @param _feePercentage new percentage
     */
	function setMinFeePercentage(uint _feePercentage) external onlyOwner {
		require(_feePercentage > 0 && _feePercentage < 1000, 'Invalid percentage');
		minFeePercentage = _feePercentage;
		emit SetMinFeePercentage(_feePercentage);
	}

	/**
        @notice add moderator 
        @param _moderator new/existing wallet address
		@param _approved active/inactive flag
     */
	function setModerator(address _moderator, bool _approved) external onlyOwner {
		if (_moderator == address(0)) revert INVALID_ADDRESS();
		moderators[_moderator] = _approved;
	}

	/**
        @notice withdraw tokens from contract
        @param _tokens array of tokens to withdraw
    **/
	function withdrawTokens(address[] memory _tokens) external onlyOwner {
		uint256 length = _tokens.length;

		for (uint256 i = 0; i < length; i++) {
			address token = _tokens[i];

			if (token == address(0)) {
				(bool success, ) = payable(DAO).call{value: address(this).balance}('');
				if (!success) revert INVALID_TRANSFER_ETH();
			} else {
				uint256 balance = IERC20Upgradeable(token).balanceOf(address(this));
				if (balance > 0) {
					IERC20Upgradeable(token).safeTransfer(DAO, balance);
				}
			}
		}
	}

	/**
        @notice queue address to change boolean in mapping
        @param _managing MANAGING
        @param _address address
        @return bool
     */
	function queue(MANAGING _managing, address _address) external onlyMod returns (bool) {
		return _queue(_managing, _address);
	}

	/**
        @notice queue address to change boolean in mapping
        @param _managing MANAGING
        @param addresses address[]
     */
	function queueMany(MANAGING _managing, address[] calldata addresses) external onlyMod {
		uint256 length = addresses.length;

		for (uint256 i = 0; i < length; i++) {
			address _address = addresses[i];
			_queue(_managing, _address);
		}
	}

	/**
        @notice verify queue then set boolean in mapping
        @param _managing MANAGING
        @param _address address
        @return bool
     */
	function toggle(MANAGING _managing, address _address) external onlyMod returns (bool) {
		return _toggle(_managing, _address);
	}

	/**
        @notice verify queue then set boolean in mapping
        @param _managing MANAGING
        @param addresses address[]
     */
	function toggleMany(MANAGING _managing, address[] calldata addresses) external onlyMod {
		uint256 length = addresses.length;

		for (uint256 i = 0; i < length; i++) {
			address _address = addresses[i];
			_toggle(_managing, _address);
		}
	}

	/**
        @notice remove bridge contract from whitelist
        @param _address address
        @return bool
     */
	function removeReserveBridge(address _address) external onlyMod returns (bool) {
		return _removeReserveBridge(_address);
	}

	/**
        @notice remove bridge token asset from whitelist
        @param _address address
        @return bool
     */
	function removeReserveBridgeAsset(address _address) external onlyMod returns (bool) {
		return _removeReserveBridgeAsset(_address);
	}

	/**
        @notice checks requirements and returns altered structs
        @param queue_ mapping( address => uint )
        @param status_ mapping( address => bool )
        @param _address address
        @return bool 
     */
	function requirements(
		mapping(address => uint) storage queue_,
		mapping(address => bool) storage status_,
		address _address
	) internal view returns (bool) {
		if (!status_[_address]) {
			if (queue_[_address] == 0) revert MUST_QUEUE();
			if (queue_[_address] > block.timestamp) revert QUEUE_NOT_EXPIRED();
			return true;
		}
		return false;
	}

	/**
        @notice checks array to ensure against duplicate
        @param _list address[]
        @param _token address
        @return bool
     */
	function listContains(address[] storage _list, address _token) internal view returns (bool) {
		for (uint i = 0; i < _list.length; i++) {
			if (_list[i] == _token) {
				return true;
			}
		}
		return false;
	}

	function _removeReserveBridge(address _address) internal returns (bool) {
		if (_address == address(0)) revert INVALID_ADDRESS();

		uint256 length = reserveBridges.length;
		for (uint256 i = 0; i < length; i++) {
			if (reserveBridges[i] == _address) {
				reserveBridges[i] = reserveBridges[length - 1];
				deleteLastAddress(reserveBridges);

				isReserveBridge[_address] = false;
				return true;
			}
		}
		return false;
	}

	function _removeReserveBridgeAsset(address _address) internal returns (bool) {
		if (_address == address(0)) revert INVALID_ADDRESS();

		uint256 length = reserveBridgeAssets.length;
		for (uint256 i = 0; i < length; i++) {
			if (reserveBridgeAssets[i] == _address) {
				reserveBridgeAssets[i] = reserveBridgeAssets[length - 1];
				deleteLastAddress(reserveBridgeAssets);

				isReserveBridgeAsset[_address] = false;
				return true;
			}
		}
		return false;
	}

	function _toggle(MANAGING _managing, address _address) internal returns (bool) {
		if (_address == address(0)) revert INVALID_ADDRESS();
		bool result;
		if (_managing == MANAGING.RESERVE_BRIDGES) {
			// 0
			if (requirements(reserveBridgeQueue, isReserveBridge, _address)) {
				reserveBridgeQueue[_address] = 0;
				if (!listContains(reserveBridges, _address)) {
					reserveBridges.push(_address);
				}
			}
			result = !isReserveBridge[_address];
			if (result) isReserveBridge[_address] = result;
			else _removeReserveBridge(_address);
		} else if (_managing == MANAGING.RESERVE_BRIDGE_ASSETS) {
			// 1
			if (requirements(reserveBridgeAssetQueue, isReserveBridgeAsset, _address)) {
				reserveBridgeAssetQueue[_address] = 0;
				if (!listContains(reserveBridgeAssets, _address)) {
					reserveBridgeAssets.push(_address);
				}
			}
			result = !isReserveBridgeAsset[_address];
			if (result) isReserveBridgeAsset[_address] = result;
			else _removeReserveBridgeAsset(_address);
		} else return false;

		emit ChangeActivated(_managing, _address, result);
		return true;
	}

	function _queue(MANAGING _managing, address _address) internal returns (bool) {
		if (_address == address(0)) revert INVALID_ADDRESS();

		if (_managing == MANAGING.RESERVE_BRIDGES) {
			// 0
			reserveBridgeQueue[_address] = block.timestamp + blocksNeededForQueue;
		} else if (_managing == MANAGING.RESERVE_BRIDGE_ASSETS) {
			// 1
			reserveBridgeAssetQueue[_address] = block.timestamp + blocksNeededForQueue;
		} else return false;

		emit ChangeQueued(_managing, _address);
		return true;
	}

	function deleteLastAddress(address[] storage addressList) internal {
		require(addressList.length > 0, 'Array is empty');
		uint lastIndex = addressList.length - 1;
		delete addressList[lastIndex];
		addressList.pop();
	}
}
