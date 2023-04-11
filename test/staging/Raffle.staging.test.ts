import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { assert, expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { Address } from "hardhat-deploy/dist/types";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Test", () => {
          let raffle: Raffle, deployerAdress: Address, raffleEntranceFee: any;

          beforeEach(async function () {
              deployerAdress = (await getNamedAccounts()).deployer;
              raffle = await ethers.getContract("Raffle", deployerAdress);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", async function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                  // enter the raffle
                  console.log("Setting up test...");
                  const startingTimeStamp = await raffle.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();

                  console.log("Setting up Listener...");
                  await new Promise<void>(async (resolve, reject) => {
                      // set up the listener beofre we enter the raffle
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired");

                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();
                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee).toString()
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve(recentWinner);
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                      // then entering the raffle
                      console.log("Entering Raffle...");
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                      await tx.wait(1);
                      console.log("Ok, time to wait...");
                      const winnerStartingBalance = await accounts[0].getBalance();
                  });
              });
          });
      });
