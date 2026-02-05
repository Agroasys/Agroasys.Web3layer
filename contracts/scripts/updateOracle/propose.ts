import {ethers} from "hardhat";

async function main(){
    const [admin1] = await ethers.getSigners();

    const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";

    console.log("Admin1 address:", admin1.address);
    const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

    const newOracleAddress = "0x229C75F0cD13D6ab7621403Bd951a9e43ba53b1e";

    console.log(`\npropose oracle update to ${newOracleAddress}`);
    const tx = await escrow.proposeOracleUpdate(newOracleAddress);

    const receipt = await tx.wait();
    console.log("Oracle update proposed");
    console.log("Transaction hash:", receipt?.hash);
    console.log("Block number:", receipt?.blockNumber);
}

main().catch(console.error);