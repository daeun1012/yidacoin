const CryptoJS = require("crypto-js"),
	_ = require("lodash"),
	Wallet = require("./wallet"),
    Mempool = require("./mempool");
	Transactions = require("./transactions"),
	hexToBinary = require("hex-to-binary");

const { getBalance, getPublicFromWallet, getPrivateFromWallet, createTx } = Wallet;

const { createCoinbaseTx, processTxs } = Transactions;

const { addToMempool, getMempool, updateMempool } = Mempool;

// 블럭 생성 주기 ( 시간 단위 s )
const BLOCK_GENERATION_INTERVAL = 10 * 1000;
// 난이도 조절 블럭 주기
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

class Block {
	constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
		this.index = index;
		this.hash = hash;
		this.previousHash = previousHash;
		this.timestamp = timestamp;
		this.data = data;
		this.difficulty = difficulty;
		this.nonce = nonce;
	}
}

const genesisTx = {
	txIns: [{signature: "", txOutId: "", txOutIndex: 0}],
	txOuts: [
		{
            address: "04572b97060884228ad8ad8dc5183e9a705a4ac12a1bdbe4c46994245b4d4ed3c34fb393e1e96a206185c37cace2957f93417d5666b85ed76fbec20b6715f93f07",
			amount: 50
		}
	],
	id: "1e1c18a7e5702d5bf07c88a541b2a3bf0eb72733aa40bec1dbcef6417338b324"
};

// 최초 블록
const genesisBlock = new Block(
	0,
	"f9e59d93e732ce891aa0b87d636388f198d11ccb1dbabd62ad25796dd76377d2",
	null,
	1521168884757,
	[genesisTx],
	0,
	0
);

let blockchain = [genesisBlock];

// unspent outputs
let uTxOuts = processTxs(blockchain[0].data, [], 0);

// 마지막 블럭 index 가져오기
const getNewestBlock = () => blockchain[blockchain.length - 1];

// timestamp 가져오기
const getTimestamp = () => new Date().getTime().valueOf();

const getBlockchain = () => blockchain;

// 해시 생성
// SHA256 이용. 비트코인도 SHA256 사용중
const createHash  = (index, previousHash, timestamp, data, difficulty, nonce) =>
	CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce).toString();

// 새로운 블럭 생성 (coinbase)
const createNewBlock = () => {
	const coinbaseTx = createCoinbaseTx(getPublicFromWallet(), getNewestBlock().index + 1);
	const blockData = [coinbaseTx].concat(getMempool());
	return createNewRawBlock(blockData);
};

// 새로운 블럭 생성
const createNewRawBlock = data => {
	// 이전 블럭 (마지막 블럭)
	const previousBlock  = getNewestBlock();
	// 새로운 블럭의 index
	const newBlockIndex = previousBlock.index + 1;
	// 현재 timestamp
	const newTimestamp = getTimestamp();
	// 난이도
	const difficulty = findDifficulty();

	// 새로운 블럭 생성
	const newBlock = findBlock(
		newBlockIndex,
		previousBlock.hash,
		newTimestamp,
		data,
		difficulty
	);
	addBlockToChain(newBlock);
	require("./p2p").broadcastNewBlock();
	return newBlock;
};

// 난이도 찾기
const findDifficulty = () => {
	const newestBlock = getNewestBlock();
	if (
		newestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
        newestBlock.index !== 0
	) {
		return calculateNewDifficulty(newestBlock, getBlockchain());
	} else {
		return newestBlock.difficulty;
	}
};

// 난이도 계산하기
const calculateNewDifficulty = (newestBlock, blockchain) => {
	const lastCalculatedBlock =
        blockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
	const timeExpected =
        BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
	const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;
	if (timeTaken < timeExpected / 2) {
		return lastCalculatedBlock.difficulty + 1;
	} else if (timeTaken > timeExpected * 2) {
		return lastCalculatedBlock.difficulty - 1;
	} else {
		return lastCalculatedBlock.difficulty;
	}
};

// 난이도에 맞는 블럭 찾기
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
	let nonce = 0;
	while (true) {
		console.log("Current nonce", nonce);
		const hash = createHash(
			index,
			previousHash,
			timestamp,
			data,
			difficulty,
			nonce
		);
		if (hashMatchesDifficulty(hash, difficulty)) {
			return new Block(
				index,
				hash,
				previousHash,
				timestamp,
				data,
				difficulty,
				nonce
			);
		}
		nonce++;
	}
};

// 난이도에 맞는 해시값 찾기
const hashMatchesDifficulty = (hash, difficulty = 0) => {
	const hashInBinary = hexToBinary(hash);
	const requiredZeros = "0".repeat(difficulty);
	console.log("Trying difficulty:", difficulty, "with hash", hashInBinary);
	return hashInBinary.startsWith(requiredZeros);
};

// 해당 블럭의 hash 를 생성
const getBlockHash = block =>
	createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

// timestamp 유효성 검사
const isTimeStampValid = (newBlock, oldBlock) => {
	return (
		oldBlock.timestamp - 60 * 1000 < newBlock.timestamp &&
        newBlock.timestamp - 60 * 1000 < getTimestamp()
	);
};

// 새로 생성한 블럭의 contents 검사
const isBlockValid = (candidateBlock, latestBlock) => {
	if(!isBlockStructureValid(candidateBlock)) {
		// 블럭 구조 부적절
		console.log("The candidate block structure is not vaild");
		return false;
	} else if(latestBlock.index + 1 !== candidateBlock.index) {
		// 이전(마지막) 블럭의 index + 1 과 생성한 블럭의 index 불일치
		console.log("The candidate block does not have a vaild index");
		return false;

	} else if(latestBlock.hash !== candidateBlock.previousHash) {
		// 이전(마지막) 블럭의 해시와 생성한 블럭의 이전블럭 해시 불일치
		console.log("The previousHash of the candidate block is not the hash of the latest block");
		return false;
	} else if(getBlockHash(candidateBlock) !== candidateBlock.hash) {
		// 생성한 블럭의 해시값 불일치
		console.log("The hash of this block is invalid");
		return false;
	} else if (!isTimeStampValid(candidateBlock, latestBlock)) {
		// timestamp 유효성 에러
		console.log("The timestamp of this block is dodgy");
		return false;
	}

	return true;
};

// 새로 생성한 블럭의 구조 검사
const isBlockStructureValid = block => {
	return (
		typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
	);
};

// 블럭체인 검증
const isChainVaild = candidateChain => {
	// 최초 블럭 검증
	const isGenesisValid = block => {
		return JSON.stringify(block) === JSON.stringify(genesisBlock);
	};

	if (!isGenesisValid(candidateChain[0])) {
		// 최초 블럭 불일치
		console.log("THe candidateChain's genesisBlock is not the same as our genesisBlock");
		return false;
	}

	// 모든 블럭 해시 검사
	// 최초 블럭은 이전 해시가 없기 때문에 index 가 1 부터 시작 ===> 최초 블럭 제외 검사
	for(let i = 1; i < candidateChain.length; i++) {
		if(!isBlockValid(candidateChain[i], candidateChain[i - 1])) {
			return false;
		}
	}

	return true;
};

// 난이도의 합
const sumDifficulty = anyBlockchain =>
	anyBlockchain
		.map(block => block.difficulty)
		.map(difficulty => Math.pow(2, difficulty))
		.reduce((a, b) => a + b);

// 검증이 끝난 체인을 받아들임
const replaceChain = candidateChain => {
	// chain 유효성 검사 && 난이도의 합이 더 큰 쪽으로 변경
	if(isChainVaild(candidateChain) && sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())) {
		blockchain = candidateChain;
		return true;
	} else {
		return false;
	}
};

// block을 새로운 체인에 등록
const addBlockToChain = candidateBlock => {
	if(isBlockValid(candidateBlock, getNewestBlock())) {
		const processedTxs = processTxs(candidateBlock.data, uTxOuts, candidateBlock.index);

		if(processedTxs === null) {
			console.log("Could not process txs");
			return false;
		} else {
            blockchain.push(candidateBlock);
            uTxOuts = processedTxs;
            updateMempool(uTxOuts);
            return true;
		}
	} else {
		return false;
	}
};

// unspent transaction output list 가져오기 (deep copy)
const getUTxOutList = () => _.cloneDeep(uTxOuts);

// 잔고 가져오기
const getAccountBalance = () => getBalance(getPublicFromWallet(), uTxOuts);

// transaction 보내기 ( mempool)
const sendTx = (address, amount) => {
	const tx = createTx(address, amount, getPrivateFromWallet(), getUTxOutList(), getMempool());
	addToMempool(tx, getUTxOutList());
	return tx;
};

module.exports = {
	getBlockchain,
    createNewBlock,
	getNewestBlock,
	isBlockStructureValid,
	addBlockToChain,
	replaceChain,
    getAccountBalance,
    sendTx
};
