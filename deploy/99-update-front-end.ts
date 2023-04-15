import { ethers, network } from "hardhat";
import fs from "fs";
import { Raffle } from "../typechain-types/contracts/Raffle";

const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery-fcc-1/constants/abi.json";
const FRONT_END_ADDRESSES_FILE =
    "../nextjs-smartcontract-lottery-fcc-1/constants/contractAddress.json";

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating frontend!!!!");
        updateContractAddresses();
        updateAbi();
    }
};

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle");
    const raffleAbi = raffle.interface;
    const FormatTypes = ethers.utils.FormatTypes;

    fs.writeFileSync(FRONT_END_ABI_FILE, raffleAbi.format(FormatTypes.json));
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle");
    const chainId = network.config.chainId!.toString();
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"));
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address);
        }
    } else {
        currentAddresses[chainId] = [raffle.address];
    }
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
}

module.exports.tags = ["all", "frontend"];
