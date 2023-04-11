import { error, log } from "console";
import { ethers } from "hardhat";

async function enterRaffle() {
    const raffle = await ethers.getContract("Raffle");
    const entranceFee = await raffle.getEntranceFee();
    await raffle.enterRaffle({ value: entranceFee + 1 });
    console.log("Entered Raffle!");
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error);
        process.exit;
    });
