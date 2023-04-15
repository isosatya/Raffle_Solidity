import { ethers, network } from "hardhat";

// this script is used for chosing a winner when working on the local network

async function mockKeepers() {
    const raffle = await ethers.getContract("Raffle");
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""));

    const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(checkData);

    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep(checkData);
        const txReceipt = await tx.wait(1);
        const requestId = txReceipt.events[1].args.requestId;
        console.log(`Performed upkeep with RequestId: ${requestId}`);
        if ((network.config.chainId = 31337)) {
            await mockVrf(requestId, raffle);
        } else {
            console.log("No upkeep needed!!!");
        }
    }
}

async function mockVrf(requestId, raffle) {
    console.log("We are pretending that we are on local network...");
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address);
    console.log("vrfCoordinatorV2Mock responded!!!");
    const recentWinner = await raffle.getRecentWinner();
    console.log(`The winner is: ${recentWinner}`);
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error);
        process.exit(1);
    });
