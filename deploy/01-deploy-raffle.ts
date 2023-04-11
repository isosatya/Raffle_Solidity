import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, network } from "hardhat";
import {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} from "../helper-hardhat-config";
import verify from "../utils/verify";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { VRFCoordinatorV2Mock } from "../typechain-types/@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock";

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");

const deployRaffle: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { getNamedAccounts, deployments, network } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    // or network.name ??
    const chainId = network.config.chainId!;
    let vrfCoordinatorV2Adress, subscriptionId, vrfCoordinatorV2Mock: any;

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Adress = vrfCoordinatorV2Mock.address;
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        // we fake a subscription and get the ID from the mock
        subscriptionId = transactionReceipt.events[0].args.subId;
        // we fund the fake subscription with a certain amount
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Adress = networkConfig[network.config.chainId!]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[network.config.chainId!]["subscriptionId"];
    }

    const entranceFee = networkConfig[network.config.chainId!]["raffleEntranceFee"];
    const gasLane = networkConfig[network.config.chainId!]["gasLane"];
    const callbackGasLimit = networkConfig[network.config.chainId!]["callbackGasLimit"];
    const interval = networkConfig[network.config.chainId!]["keepersUpdateInterval"];

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;

    const args = [
        vrfCoordinatorV2Adress,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
    }

    // verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifiying...");
        await verify(raffle.address, args);
    }
};

export default deployRaffle;
deployRaffle.tags = ["all", "raffle"];
