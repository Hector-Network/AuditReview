// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract RewardToken2 is ERC20 {
    string private NAME = 'Reward Hector';
    string private SYMBOL = 'RHEC';
    uint8 private _decimals = 18;    

    uint256 public _totalSupply = 10000000000000000000000000000;

    constructor(string memory _name, string memory _symbol, uint8 decimalsDigit) ERC20(_name, _symbol) {
        NAME = _name;
        SYMBOL = _symbol;
        _decimals = decimalsDigit;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setTotalSupply(uint256 __totalSupply) external {
        _totalSupply = __totalSupply;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function name() public view virtual override returns (string memory) {
        return NAME;
    }

    function symbol() public view virtual override returns (string memory) {
        return SYMBOL;
    }

    function setDecimals(uint8 digits) external {
        _decimals = digits;
    }

    function setName(string calldata _name) external {
        NAME = _name;
    }

    function setSymbol(string calldata _symbols) external {
        SYMBOL = _symbols;
    }
}
