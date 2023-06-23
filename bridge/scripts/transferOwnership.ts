require('dotenv').config();
import exec from 'child_process';

async function main() {
	const cmd = exec.exec;
    const execsync = exec.execSync;
    //1
  	console.log('transfer ownership on the FTM network...');
	const cmdForDeployFTM = `hardhat run ./scripts/transferOwnership/ftm.ts --network ftm`;
	console.log(execsync(cmdForDeployFTM).toString());
    console.log("Done")
    //2
    console.log('transfer ownership on the Polygon network...');
    const cmdForDeployPolygon = `hardhat run ./scripts/transferOwnership/polygon.ts --network polygon`;
	console.log(execsync(cmdForDeployPolygon).toString());
    console.log("Done")
    //3
	console.log('transfer ownership on the ArbitrumOne network...');
    const cmdForDeployArbitrum = `hardhat run ./scripts/transferOwnership/arbitrum.ts --network arbitrumOne`;
	console.log(execsync(cmdForDeployArbitrum).toString());
    console.log("Done")
	//4
    console.log('transfer ownership on the Avalanche network...');
    const cmdForDeployAvax = `hardhat run ./scripts/transferOwnership/avax.ts --network avalanche`;
	console.log(execsync(cmdForDeployAvax).toString());
    console.log("Done")
    //5
    console.log('transfer ownership on the BSC network...');
    const cmdForDeployBsc = `hardhat run ./scripts/transferOwnership/bsc.ts --network bsc`;
	console.log(execsync(cmdForDeployBsc).toString());
    console.log("Done")
    //6
    console.log('transfer ownership on the Celo network...');
    const cmdForDeployCelo = `hardhat run ./scripts/transferOwnership/celo.ts --network celo`;
	console.log(execsync(cmdForDeployCelo).toString());
    console.log("Done")
    //7
    console.log('transfer ownership on the ETH network...');
    const cmdForDeployeth = `hardhat run ./scripts/transferOwnership/eth.ts --network mainnet`;
	console.log(execsync(cmdForDeployeth).toString());
    console.log("Done")
    //8
    console.log('transfer ownership on the Optimizm network...');
    const cmdForDeployOptimizm = `hardhat run ./scripts/transferOwnership/optimizm.ts --network optimizm`;
	console.log(execsync(cmdForDeployOptimizm).toString());
    console.log("Done")
    //9
    console.log('transfer ownership on the Moonriver network...');
    const cmdForDeployMoonriver = `hardhat run ./scripts/transferOwnership/moonriver.ts --network moonriver`;
	console.log(execsync(cmdForDeployMoonriver).toString());
    console.log("Done")
    //10
    console.log('transfer ownership on the Moonbeam network...');
    const cmdForDeployMoonbeam = `hardhat run ./scripts/transferOwnership/moonriver.ts --network moonbeam`;
	console.log(execsync(cmdForDeployMoonbeam).toString());
    console.log("Done")
    //11
    console.log('transfer ownership on the Gnosis network...');
    const cmdForDeployGnosis = `hardhat run ./scripts/transferOwnership/gnosis.ts --network gnosis`;
	console.log(execsync(cmdForDeployGnosis).toString());
    console.log("Done")
    //12
    console.log('transfer ownership on the Aurora network...');
    const cmdForDeployAurora = `hardhat run ./scripts/transferOwnership/aurora.ts --network aurora`;
	console.log(execsync(cmdForDeployAurora).toString());
    console.log("Done")
    //13
    console.log('transfer ownership on the Cronos network...');
    const cmdForDeployCronos = `hardhat run ./scripts/transferOwnership/cronos.ts --network cronos`;
	console.log(execsync(cmdForDeployCronos).toString());
    console.log("Done")
    //14
    console.log('transfer ownership on the Fuse network...');
    const cmdForDeployFuse = `hardhat run ./scripts/transferOwnership/fuse.ts --network fuse`;
	console.log(execsync(cmdForDeployFuse).toString());
    console.log("Done")
    //15
    console.log('transfer ownership on the Okex network...');
    const cmdForDeployOkex = `hardhat run ./scripts/transferOwnership/okex.ts --network okex`;
    console.log(execsync(cmdForDeployOkex).toString());
    console.log("Done")
    //16
    console.log('transfer ownership on the Boba network...');
    const cmdForDeployBoba = `hardhat run ./scripts/transferOwnership/boba.ts --network boba`;
    console.log(execsync(cmdForDeployBoba).toString());
    console.log("Done")
    //17
    console.log('transfer ownership on the Velas network...');
    const cmdForDeployVelas = `hardhat run ./scripts/transferOwnership/velas.ts --network velas`;
    console.log(execsync(cmdForDeployVelas).toString());
    console.log("Done")
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
