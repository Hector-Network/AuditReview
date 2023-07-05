require('dotenv').config();
import exec from 'child_process';

async function main() {
	const cmd = exec.exec;
    const execsync = exec.execSync;
    //1
  	console.log('deploying on the FTM network...');
	const cmdForDeployFTM = `hardhat run ./scripts/deployment/ftm.ts --network ftm`;
	console.log(execsync(cmdForDeployFTM).toString());
    console.log("Done")
    //2
    console.log('deploying on the Polygon network...');
    const cmdForDeployPolygon = `hardhat run ./scripts/deployment/polygon.ts --network polygon`;
	console.log(execsync(cmdForDeployPolygon).toString());
    console.log("Done")
    //3
	console.log('deploying on the ArbitrumOne network...');
    const cmdForDeployArbitrum = `hardhat run ./scripts/deployment/arbitrum.ts --network arbitrumOne`;
	console.log(execsync(cmdForDeployArbitrum).toString());
    console.log("Done")
	//4
    console.log('deploying on the Avalanche network...');
    const cmdForDeployAvax = `hardhat run ./scripts/deployment/avax.ts --network avalanche`;
	console.log(execsync(cmdForDeployAvax).toString());
    console.log("Done")
    //5
    console.log('deploying on the BSC network...');
    const cmdForDeployBsc = `hardhat run ./scripts/deployment/bsc.ts --network bsc`;
	console.log(execsync(cmdForDeployBsc).toString());
    console.log("Done")
    //6
    console.log('deploying on the Celo network...');
    const cmdForDeployCelo = `hardhat run ./scripts/deployment/celo.ts --network celo`;
	console.log(execsync(cmdForDeployCelo).toString());
    console.log("Done")
    //7
    console.log('deploying on the ETH network...');
    const cmdForDeployeth = `hardhat run ./scripts/deployment/eth.ts --network mainnet`;
	console.log(execsync(cmdForDeployeth).toString());
    console.log("Done")
    //8
    console.log('deploying on the Optimizm network...');
    const cmdForDeployOptimizm = `hardhat run ./scripts/deployment/optimizm.ts --network optimizm`;
	console.log(execsync(cmdForDeployOptimizm).toString());
    console.log("Done")
    //9
    console.log('deploying on the Moonriver network...');
    const cmdForDeployMoonriver = `hardhat run ./scripts/deployment/moonriver.ts --network moonriver`;
	console.log(execsync(cmdForDeployMoonriver).toString());
    console.log("Done")
    //10
    console.log('deploying on the Moonbeam network...');
    const cmdForDeployMoonbeam = `hardhat run ./scripts/deployment/moonriver.ts --network moonbeam`;
	console.log(execsync(cmdForDeployMoonbeam).toString());
    console.log("Done")
    //11
    console.log('deploying on the Gnosis network...');
    const cmdForDeployGnosis = `hardhat run ./scripts/deployment/gnosis.ts --network gnosis`;
	console.log(execsync(cmdForDeployGnosis).toString());
    console.log("Done")
    //12
    console.log('deploying on the Aurora network...');
    const cmdForDeployAurora = `hardhat run ./scripts/deployment/aurora.ts --network aurora`;
	console.log(execsync(cmdForDeployAurora).toString());
    console.log("Done")
    //13
    console.log('deploying on the Cronos network...');
    const cmdForDeployCronos = `hardhat run ./scripts/deployment/cronos.ts --network cronos`;
	console.log(execsync(cmdForDeployCronos).toString());
    console.log("Done")
    //14
    console.log('deploying on the Fuse network...');
    const cmdForDeployFuse = `hardhat run ./scripts/deployment/fuse.ts --network fuse`;
	console.log(execsync(cmdForDeployFuse).toString());
    console.log("Done")
    //15
    console.log('deploying on the Okex network...');
    const cmdForDeployOkex = `hardhat run ./scripts/deployment/okex.ts --network okex`;
    console.log(execsync(cmdForDeployOkex).toString());
    console.log("Done")
    //16
    console.log('deploying on the Boba network...');
    const cmdForDeployBoba = `hardhat run ./scripts/deployment/boba.ts --network boba`;
    console.log(execsync(cmdForDeployBoba).toString());
    console.log("Done")
    //17
    console.log('deploying on the Velas network...');
    const cmdForDeployVelas = `hardhat run ./scripts/deployment/velas.ts --network velas`;
    console.log(execsync(cmdForDeployVelas).toString());
    console.log("Done")
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
