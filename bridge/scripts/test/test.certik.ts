const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    const HecBridgeSplitterFatory = await ethers.getContractFactory("HecBridgeSplitterTest")
    const hecBridgeSplitterContract = await HecBridgeSplitterFatory.deploy()
    let tx1 = await hecBridgeSplitterContract.setUp()
    await tx1.wait()
    console.log("Did set up DAO wallet and dest count")
    let tx2 = await hecBridgeSplitterContract.testBridge({ value: "2000000000000000000" })
    await tx2.wait()
    console.log("Checked if call target address should receive 1 eth")
    console.log("Testing succeeded")
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
