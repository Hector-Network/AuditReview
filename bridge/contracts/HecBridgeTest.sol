// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import './HecBridgeSplitter.sol';

	enum MANAGING {
		RESERVE_BRIDGES,
		RESERVE_BRIDGE_ASSETS
	}

contract HecBridgeSplitterTest {
	HecBridgeSplitter public bridge;

	function setUp() public {
		bridge = new HecBridgeSplitter();
		address DAO = address(1);
		bridge.initialize(1, 0, address(0));
		bridge.setDAO(DAO);
        
	}

	function testBridge() public payable {
		BridgeContract _callAddress = new BridgeContract();

        bridge.queue(HecBridgeSplitter.MANAGING.RESERVE_BRIDGES, address(_callAddress));
        bridge.toggle(HecBridgeSplitter.MANAGING.RESERVE_BRIDGES, address(_callAddress));
        
		HecBridgeSplitter.SendingAssetInfo[]
        memory sendingAsserInfos = new HecBridgeSplitter.SendingAssetInfo[](1);
		sendingAsserInfos[0].callData = abi.encodeWithSignature('receive()');
		sendingAsserInfos[0].sendingAmount = 0.9 ether;
		sendingAsserInfos[0].totalAmount = 1 ether;
		sendingAsserInfos[0].feeAmount = 0.1 ether;
		sendingAsserInfos[0].bridgeFee = 0.1 ether;

		bridge.bridgeNative{value: 1.1 ether}(sendingAsserInfos, address(_callAddress));
        
		require(address(_callAddress).balance == 1 ether, 'call address should receive 1 eth');
	}
}

contract BridgeContract {
	function receive() public payable {}
}
