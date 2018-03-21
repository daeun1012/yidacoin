const CryptoJS = require("crypto-js"),
    hexToBinary = require("hex-to-binary");

// 블럭이 생성되는 주기 ( 시간 단위 s )
const BLOCK_GENERATION_INTERVAL = 10 * 1000;

// 난이도를 조절하는 블럭 주기 ( 블럭 갯수 )
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

// 최초 블록
const genesisBlock = new Block(
	0,
	"E4FC1B06F01D2BACAFF97D534F284C0618897B64D4CB36EF28582A26A2C6921F",
	null,
	1521168884757,
	"This is the genesis!!",
    2,
    0
);

let blockchain = [genesisBlock];

// 마지막 블럭 index 가져오기
const getNewestBlock = () => blockchain[blockchain.length - 1];

// timestamp 가져오기
const getTimestamp = () => new Date().getTime().valueOf();

const getBlockchain = () => blockchain;

// 해시 생성
// SHA256 이용. 비트코인도 SHA256 사용중
const createHash  = (index, previousHash, timestamp, data, difficulty, nonce) =>
    CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce).toString();

// 블럭 난이도 찾기
const findDifficulty = () => {
    const newestBlock = getNewestBlock();
    if(newestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && newestBlock.index !== 0) {
        // 블럭 난이도 계산
        return calculateNewDifficulty(newestBlock, getBlockchain());
    } else {
        return newestBlock.difficulty;
    }
}

// 블럭 난이도 계산
const calculateNewDifficulty = (newestBlock, blockchain) => {
    // 마지막 난이도 계산 블럭
    const lastCalculatedBlock = blockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    // 채굴 예상 시간
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    // 실제 채굴 시간 (주기동안)
    const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;

    console.log("timeTaken : ", timeTaken, ", timeExpected : ", timeExpected);

    if(timeTaken < timeExpected / 2) {
        // 예상 시간보다 2배 이하
        // 난이도를 높힌다
        return lastCalculatedBlock.difficulty + 1;
    } else if(timeTaken > timeExpected * 2) {
        // 예상 시간보다 2배 이상
        // 난이도를 낮춘다
        return lastCalculatedBlock.difficulty - 1;
    } else {
        return lastCalculatedBlock.difficulty;
    }
}

// 새로운 블럭 생성
const createNewBlock = data => {
	// 이전 블럭 (마지막 블럭)
	const previousBlock  = getNewestBlock();
	// 새로운 블럭의 index
	const newBlockIndex = previousBlock.index + 1;
	// 현재 timestamp
	const newTimestamp = getTimestamp();
    // 블럭 난이도 찾기
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

// 난이도에 맞는 블럭을 생성한다.
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    // 난이도에 따른 해시 생성
    while(true) {
        const hash = createHash(
            index,
            previousHash,
            timestamp,
            data,
            difficulty,
            nonce
        );
        // nonce 를 찾는다
        if(hashMatchesDifficulty(hash, difficulty)) {
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

// nonce 를 찾는다
const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = hexToBinary(hash);
    const requiredToZero = "0".repeat(difficulty);
    //console.log("Trying difficulty: ", difficulty, "with hashInBinary ", hashInBinary);
    return hashInBinary.startsWith(requiredToZero);
}

// 해당 블럭의 hash 를 생성
const getBlockHash = block => createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

// 시간 유효성 검사
const isTimestampValid = (newBlock, oldBlock) => {
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
	} else if(!isTimestampValid(candidateBlock, latestBlock)) {
	    // 유효하지 않은 timestamp
        console.log("The timestamp of block is dodgy");
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

// 모든 난이도를 더한다
const sumDifficulty = anyBlockchain => {
    anyBlockchain
        .map(block => block.difficulty)
        .map(difficulty => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
}

// 검증이 끝난 체인을 받아들임
const replaceChain = candidateChain => {
	// chain 유효성 검사 && 새로운 체인의 난이도가 더 높다면
	if(isChainVaild(candidateChain) &&
        sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())) {
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
