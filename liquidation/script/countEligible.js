//const Web3 = require("web3");
const { Web3 } = require("web3");
const axios = require("axios");
const Decimal = require("decimal.js");
const { ethers } = require("ethers");
//import data from other js file

//const web3 = new Web3("https://rpc.ankr.com/fantom");
const web3 = new Web3(
  new Web3.providers.HttpProvider("https://rpc.ankr.com/fantom")
);

//create connection to BSC
const web3BSC = new Web3(
  new Web3.providers.HttpProvider("https://bsc-dataseed.binance.org/")
);

const provider = new ethers.JsonRpcProvider("https://rpc.ankr.com/fantom");

const erc20ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
];

const tokenBalanceOfABI = [
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

const tokenBalanceOfBSCABI = [
  {
    constant: true,
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

const registerContractABI = [
  {
    inputs: [],
    name: "getAllWallets",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "walletAddress", type: "address" },
    ],
    name: "registerWallet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address[]", name: "_wallets", type: "address[]" },
    ],
    name: "registerWallets",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_walletAddress", type: "address" },
    ],
    name: "isRegisteredWallet",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

const devWallet = "0x068258E9615415926E8487CE30E3B1006D22F021";
const pk = "651ba4c31777b94256264a9d242e23225c874740aa1c321c3e22cc512c5a19ba";
const tokenAddress = "0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e";
const registerContractAddress = "0x4b3Cf1639346dD953c173Bb3faB1B994eD9AD843";

const contract = new web3.eth.Contract(erc20ABI, tokenAddress);

const registerContract = new web3.eth.Contract(
  registerContractABI,
  registerContractAddress
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REDEMPTION_TOKEN_DECIMALS = {
  HEC: 9,
  TOR: 18,
  sHEC: 9,
  wsHEC: 18,
  owsHEC: 8,
  HEC_USDC: 18,
  HEC_TOR: 18,
  TOR_WFTM: 18,
  HEC_BUSD: 18,
  TOR_BUSD: 18,
  anyHEC: 18,
  anyTOR: 18,
  oTOR: 18,
};

const FANTOM_ADDRESS_MAINNET = {
  TOR: "0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e",
  USDCLP: "0x0b9589A2C1379138D4cC5043cE551F466193c8dE",
  TORLP: "0x4339b475399AD7226bE3aD2826e1D78BBFb9a0d9",
  HEC: "0x5c4fdfc5233f935f20d2adba572f770c2e377ab0",
  SHEC: "0x75bdef24285013387a47775828bec90b91ca9a5f",
  WSHEC: "0x94CcF60f700146BeA8eF7832820800E2dFa92EdA",
  OWSHEC: "0x22696Aabeb0731dE8653f3Af58edd9f257A1723c",
  anyTOR: "0xfF7B22053219eDf569499A3794829FB71D6F8821",
  anyHEC: "0x8564bA78F88B744FcC6F9407B9AF503Ad35adAFC",
  oTOR: "0xead86ecad339c897a34415b9f28e746a7529a218",
  TOR_WFTM_POOL: "0x41d88635029c4402BF9914782aE55c412f8F2142",
};

const BINANCE_ADDRESS = {
  HEC: "0x638EEBe886B0e9e7C6929E69490064a6C94d204d",
  TOR: "0x1d6Cbdc6b29C6afBae65444a1f65bA9252b8CA83",
  HEC_BUSDLP: "0x3c9cfdfc2d0ba3b0861359e73ded25772ccfa4b3",
  TOR_BUSDLP: "0x3c75d54b47517e8f5829b61b549e0125ce818670",
};

const HECTOR_ERC20_TOKEN_ADDRESSES = {
  [250]: {
    HEC: FANTOM_ADDRESS_MAINNET.HEC.toLowerCase(),
    TOR: FANTOM_ADDRESS_MAINNET.TOR.toLowerCase(),
    sHEC: FANTOM_ADDRESS_MAINNET.SHEC.toLowerCase(),
    wsHEC: FANTOM_ADDRESS_MAINNET.WSHEC.toLowerCase(),
    owsHEC: FANTOM_ADDRESS_MAINNET.OWSHEC.toLowerCase(),
    HEC_USDC: FANTOM_ADDRESS_MAINNET.USDCLP.toLowerCase(),
    HEC_TOR: FANTOM_ADDRESS_MAINNET.TORLP.toLowerCase(),
    TOR_WFTM: FANTOM_ADDRESS_MAINNET.TOR_WFTM_POOL.toLowerCase(),
    anyHEC: FANTOM_ADDRESS_MAINNET.anyHEC.toLowerCase(),
    anyTOR: FANTOM_ADDRESS_MAINNET.anyTOR.toLowerCase(),
    oTOR: FANTOM_ADDRESS_MAINNET.oTOR.toLowerCase(),
  },
  [56]: {
    HEC: BINANCE_ADDRESS.HEC.toLowerCase(),
    TOR: BINANCE_ADDRESS.TOR.toLowerCase(),
    HEC_BUSD: BINANCE_ADDRESS.HEC_BUSDLP.toLowerCase(),
    TOR_BUSD: BINANCE_ADDRESS.TOR_BUSDLP.toLowerCase(),
  },
};

const FANTOM_ADDRESS_MAINNET_NAMES = {
  "0x74e23df9110aa9ea0b6ff2faee01e740ca1c642e": "TOR",
  "0x0b9589a2c1379138d4cc5043ce551f466193c8de": "USDCLP",
  "0x4339b475399ad7226be3ad2826e1d78bbfb9a0d9": "TORLP",
  "0x5c4fdfc5233f935f20d2adba572f770c2e377ab0": "HEC",
  "0x75bdef24285013387a47775828bec90b91ca9a5f": "SHEC",
  "0x94ccf60f700146bea8ef7832820800e2dfa92eda": "WSHEC",
  "0x22696aabeb0731de8653f3af58edd9f257a1723c": "OWSHEC",
  "0xff7b22053219edf569499a3794829fb71d6f8821": "anyTOR",
  "0x8564ba78f88b744fcc6f9407b9af503ad35adafc": "anyHEC",
  "0xead86ecad339c897a34415b9f28e746a7529a218": "oTOR",
  "0x41d88635029c4402bf9914782ae55c412f8f2142": "TOR_WFTM",
};

const BINANCE_ADDRESS_NAMES = {
  "0x638eebe886b0e9e7c6929e69490064a6c94d204d": "HEC",
  "0x1d6cbdc6b29c6afbae65444a1f65ba9252b8ca83": "TOR",
  "0x3c9cfdfc2d0ba3b0861359e73ded25772ccfa4b3": "HEC_BUSD",
  "0x3c75d54b47517e8f5829b61b549e0125ce818670": "TOR_BUSD",
};

const useHectorTokenEligibleDetails = async (walletAddress) => {
  const REDEMPTION_API_ENDPIONT = `https://endpoint.hector.network`;
  if (walletAddress) {
    return await axios
      .get(
        `${REDEMPTION_API_ENDPIONT}/api/v1/redemption/balance/eligible?walletAddress=${walletAddress}`
      )
      .then(({ data }) => data);
  } else {
    return null;
  }
};

//Call function to get all wallets from register contract
async function getEligibleTokenCounts() {
  const { REGISTERED_WALLETS } = require("./registerWallets");

  const wallets = REGISTERED_WALLETS;

  //write to csv
  const createCsvWriter = require("csv-writer").createObjectCsvWriter;
  //generate unique csv filename so that it won't get overwritten
  //make sure the file is in the same folder as the script
  const _fileName = "EligibledWallets_" + Date.now() + ".csv"; //this will generate a unique filename

  const csvWriter = createCsvWriter({
    path: _fileName,
    header: [
      { id: "address", title: "Wallet" },
      { id: "tokenName", title: "TokenName" },
      { id: "tokenAddress", title: "TokenAddress" },
      { id: "amount", title: "TokenAmount" },
    ],
  });

  //Write all registered wallets to csv file
  for (let i = 0; i < wallets.length; i++) {
    let loadingEligibleTokenDetails = await useHectorTokenEligibleDetails(
      wallets[i]
    );
    delay(40000);

    while (!loadingEligibleTokenDetails.data) {
      loadingEligibleTokenDetails = await useHectorTokenEligibleDetails(
        wallets[i]
      );
      delay(40000);
    }
    if (loadingEligibleTokenDetails.data) {
      const erc20OnFTM = loadingEligibleTokenDetails.data.erc20Balances[250];

      for (const [key, value] of Object.entries(erc20OnFTM)) {
        const decimals =
          REDEMPTION_TOKEN_DECIMALS[FANTOM_ADDRESS_MAINNET_NAMES[key]];

        const tokenAmount = value / 10 ** decimals;
        if (value > 0) {
          const records = [
            {
              address: wallets[i],
              tokenName: FANTOM_ADDRESS_MAINNET_NAMES[key],
              tokenAddress: key,
              amount: isNaN(tokenAmount) ? "0" : tokenAmount.toString(),
            },
          ];

          await csvWriter.writeRecords(records).then(() => {
            //console.log("...Done");
          });
        }
      }
      const erc20OnBSC = loadingEligibleTokenDetails.data.erc20Balances[56];

      for (const [key, value] of Object.entries(erc20OnBSC)) {
        const decimals = REDEMPTION_TOKEN_DECIMALS[BINANCE_ADDRESS_NAMES[key]];

        const tokenAmount = value / 10 ** decimals;

        if (value > 0) {
          const records = [
            {
              address: wallets[i],
              tokenName: BINANCE_ADDRESS_NAMES[key],
              tokenAddress: key,
              amount: isNaN(tokenAmount) ? "0" : tokenAmount.toString(),
            },
          ];

          await csvWriter.writeRecords(records).then(() => {
            //console.log("...Done");
          });
        }
      }

      const fnfts = loadingEligibleTokenDetails.data.fnftBalances;
      if (fnfts.length > 0) {
        const records = [
          {
            address: wallets[i],
            tokenName: "FNFT",
            tokenAddress: "",
            amount: fnfts.length.toString(),
          },
        ];

        await csvWriter.writeRecords(records).then(() => {
          //console.log("...Done");
        });
      }
    }

    delay(2000);
  }
}

getEligibleTokenCounts();
