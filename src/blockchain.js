const CryptoJS = require("crypto-js");

class Block {
	constructor(index, hash, previousHash, timestamp, data) {
		this.index = index;
		this.hash = hash;
		this.previousHash = previousHash;
		this.timestamp = timestamp;
		this.data = data;
	}
}

// 최초 블록
const genesisBlock = new Block(
	0,
	"E4FC1B06F01D2BACAFF97D534F284C0618897B64D4CB36EF28582A26A2C6921F",
	null,
	1521168884757,
	"This is the genesis!!"
);

let blockchain = [genesisBlock];

// 마지막 블럭 index 가져오기
const getNewestBlock = () => blockchain[blockchain.length - 1];

// timestamp 가져오기
const getTimestamp = () => new Date().getTime().valueOf();

const getBlockchain = () => blockchain;

// 해시 생성
// SHA256 이용. 비트코인도 SHA256 사용중
const createHash  = (index, previousHash, timestamp, data) => CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data)).toString();

// 새로운 블럭 생성
const createNewBlock = data => {
	// 이전 블럭 (마지막 블럭)
	const previousBlock  = getNewestBlock();
	// 새로운 블럭의 index
	const newBlockIndex = previousBlock.index + 1;
	// 현재 timestamp
	const newTimestamp = getTimestamp();
	// 새로운 해시 생성
	const newHash = createHash(
		newBlockIndex,
		previousBlock.hash,
		newTimestamp,
		data
	);

	// 새로운 블럭 생성
	const newBlock = new Block(
		newBlockIndex,
		newHash,
		previousBlock.hash,
		newTimestamp,
		data
	);
	addBlockToChain(newBlock);
	return newBlock;
};

// 해당 블럭의 hash 를 생성
const getBlockHash = block => createHash(block.index, block.previousHash, block.timestamp, block.data);

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
    typeof block.data === "string"
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

// 검증이 끝난 체인을 받아들임
const replaceChain = candidateChain => {
	// chain 유효성 검사 && 새로운 체인의 길이가 더 길다면 (새로운 블럭이 추가되었다면)
	if(isChainVaild(candidateChain) && candidateChain.length > getBlockchain().length) {
		blockchain = candidateChain;
		return true;
	} else {
		return false;
	}
};

// block을 새로운 체인에 등록
const addBlockToChain = candidateBlock => {
	if(isBlockValid(candidateBlock, getNewestBlock())) {
		getBlockchain().push(candidateBlock);
		return true;
	} else {
		return false;
	}
};

module.exports = {
	getBlockchain,
	createNewBlock,
	getNewestBlock,
	isBlockStructureValid,
	addBlockToChain,
	replaceChain
};
