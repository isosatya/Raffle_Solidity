import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "hardhat-gas-reporter";
import "dotenv/config";
import "@typechain/hardhat";
import "solidity-coverage";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";

/** @type import('hardhat/config').HardhatUserConfig */

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-rinkbey";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xkey";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "key";
const COINMARKETCAP_KEY = process.env.COINMARKETCAP_KEY || "key";

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: { chainId: 31337, blockConfirmations: 1 },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY!],
            chainId: 11155111, //https://chainlist.org
        },
    },
    etherscan: {
        // npx hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: {
            sepolia: ETHERSCAN_API_KEY,
        },
    },
    gasReporter: {
        enabled: false,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "USD",
        coinmarketcap: COINMARKETCAP_KEY,
        token: "MATIC",
    },
    solidity: "0.8.18",
    namedAccounts: { deployer: { default: 0 }, player: { default: 1 } },
    mocha: {
        timeout: 300000, // in miliseconds = 300 seconds --> then throws error
    },
};
