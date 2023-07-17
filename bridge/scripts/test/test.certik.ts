const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    const HecBridgeSplitterFatory = await ethers.getContractFactory("HecBridgeSplitterTest")
    console.log("Deploying HecBridgeSplitter Implementation...");
    const hecBridgeSplitterContract =  await HecBridgeSplitterFatory.deploy()
    console.log("setting up")
    let tx1 = await hecBridgeSplitterContract.setUp()
    await tx1.wait()
    console.log("testing ... ")
    let tx2 = await hecBridgeSplitterContract.testBridge({value: "2000000000000000000"})
    await tx2.wait()

}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
