// 1. get our SubID for Chainlink VRF
// 2. Deploy our contract using the SubID
// 3. Register the contract with Chainlink VRF & it´s SubID
// 4. Register the contract with Chainlink Keepers
// 5. Run staging tests

import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { assert, expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { Address } from "hardhat-deploy/dist/types";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", () => {
          let raffle: Raffle,
              vrfCoordinatorV2Mock: VRFCoordinatorV2Mock,
              deployerAdress: Address,
              raffleEntranceFee: any,
              interval: number;

          beforeEach(async function () {
              deployerAdress = (await getNamedAccounts()).deployer;
              await deployments.fixture("all");

              raffle = await ethers.getContract("Raffle", deployerAdress);
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployerAdress
              );
              raffleEntranceFee = await raffle.getEntranceFee();

              interval = (await raffle.getInterval()).toNumber();
          });

          describe("constructor", () => {
              // only testing a few variables

              it("initializes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState();
                  // 0 = OPEN  // 1 = CALCULATING
                  assert.equal(raffleState.toString(), "0");

                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId!]["keepersUpdateInterval"]
                  );
              });
          });
          describe("enterRaffle", function () {
              it("reverts when you don´t pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  );
              });
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployerAdress);
              });
              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  );
              });
              it("doesn´t allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  // evm_increaseTime & evm_mine
                  // are time travelling functions
                  await network.provider.send("evm_increaseTime", [interval + 1]);
                  // or await network.provider.request({method: "evm_mine", params: []})
                  await network.provider.send("evm_mine", []);
                  //   [] = bytes calldata (empty)
                  // performUpKeep so status of Raffle is changed to CALCULATING
                  await raffle.performUpkeep([]);
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  );
              });
          });

          describe("checkUpKeep", function () {
              it("returns false if people haven´t sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [interval + 1]);
                  await network.provider.send("evm_mine", []);
                  // we are faking calling the checkUpkeep function
                  // which in this case will return false, no one entered yet
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  // no upkeedneeded --> !false => true
                  assert(!upkeepNeeded);
              });
              it("returns false if raffle isn´t open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval + 1]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep([]);
                  // we get state which is CALCULATING
                  const raffleState = await raffle.getRaffleState();
                  // we are faking calling the checkUpkeep function
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
          });

          describe("performUpkeep", function () {
              it("performUpkeep can only run if checkUpkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval + 1]);
                  const tx = await raffle.performUpkeep([]);
                  assert(tx);
              });
              it("reverts when checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle_UpkeepNotNeeded"
                  );
              });
              it("updates the raffle state, emits an event, and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval + 1]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep([]);
                  const txReceipt = await txResponse.wait(1);
                  // function "requestRandomWords" function in VRFCoordinatorV2Mock
                  // already emits an event, so event emitted by "performUpkeep"
                  // is actually the 2nd event, therefore events[1]
                  const requestId = txReceipt!.events![1].args!.requestId;
                  const raffleState = await raffle.getRaffleState();
                  assert(requestId.toNumber() > 0);
                  assert(raffleState.toString() == "1");
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
              });
              it("picks a winner, resets the lottery, and sends money", async function () {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 1; // deployer = 0
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i]);
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp();

                  // steps:
                  // performUpkeep (mock acting as Chainlink Keepers)
                  // fulfillRandomWords (mock acting as Chainlink VRF)
                  // We have to wait for fullfillRandomWords function to be called

                  await new Promise<void>(async (resolve, reject) => {
                      // this is the listener of event WinnerPicked
                      // we are just setting up the listener, NOT picking the winner
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the WinnerPicked event!");

                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatestTimeStamp();
                              const numPlayers = await raffle.getNumberOfPlayers();
                              const winnerEndingBalance = await accounts[1].getBalance();

                              console.log(recentWinner);
                              console.log(accounts[2].address);
                              console.log(accounts[0].address);
                              console.log(accounts[1].address);
                              console.log(accounts[3].address);

                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance
                                      .add(
                                          raffleEntranceFee
                                              .mul(additionalEntrants)
                                              .add(raffleEntranceFee)
                                      )
                                      .toString()
                              );
                              resolve();
                          } catch (e) {
                              reject(e);
                          }
                      });
                      // we are picking the winner
                      const tx = await raffle.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      const winnerStartingBalance = await accounts[1].getBalance();
                      // we give 2 arguments to fulfillRandomWords: requestId and subscription address
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt!.events![1].args!.requestId,
                          raffle.address
                      );
                  });
              });
          });
      });
