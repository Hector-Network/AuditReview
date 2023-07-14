import { ethers } from 'hardhat';

export enum MANAGING {
    RESERVE_BRIDGES = 0,
    RESERVE_BRIDGE_ASSETS = 1,
  }
  
  async function getImplementationAddress(proxyAddress: string) {
    const implHex = await ethers.provider.getStorageAt(
      proxyAddress,
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
    );
    return ethers.utils.hexStripZeros(implHex);
  }
  