require('dotenv').config();
import exec from 'child_process';

async function main() {
	const cmd = exec.exec;
    const execsync = exec.execSync;

  	console.log('deploying on the FTM network...');
	const cmdForDeployFTM = `hardhat run ./scripts/deploymentScripts/ftm.ts --network ftm`;
	console.log(execsync(cmdForDeployFTM).toString());
    console.log("Done")

    console.log('deploying on the Polygon network...');
    const cmdForDeployPolygon = `hardhat run ./scripts/deploymentScripts/polygon.ts --network polygon`;
	console.log(execsync(cmdForDeployPolygon).toString());
    console.log("Done")

	console.log('deploying on the Polygon network...');
    const cmdForDeployArbitrum = `hardhat run ./scripts/deploymentScripts/arbitrum.ts --network arbitrumOne`;
	console.log(execsync(cmdForDeployArbitrum).toString());
    console.log("Done")
	
    console.log('deploying on the Polygon network...');
    const cmdForDeployAvax = `hardhat run ./scripts/deploymentScripts/avax.ts --network avalanche`;
	console.log(execsync(cmdForDeployAvax).toString());
    console.log("Done")

    console.log('deploying on the Polygon network...');
    const cmdForDeployBsc = `hardhat run ./scripts/deploymentScripts/bsc.ts --network bsc`;
	console.log(execsync(cmdForDeployBsc).toString());
    console.log("Done")

    console.log('deploying on the Polygon network...');
    const cmdForDeployCelo = `hardhat run ./scripts/deploymentScripts/celo.ts --network celo`;
	console.log(execsync(cmdForDeployCelo).toString());
    console.log("Done")

    console.log('deploying on the Polygon network...');
    const cmdForDeployeth = `hardhat run ./scripts/deploymentScripts/eth.ts --network mainnet`;
	console.log(execsync(cmdForDeployeth).toString());
    console.log("Done")

    console.log('deploying on the Polygon network...');
    const cmdForDeployOptimizm = `hardhat run ./scripts/deploymentScripts/optimizm.ts --network optimizm`;
	console.log(execsync(cmdForDeployOptimizm).toString());
    console.log("Done")

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
