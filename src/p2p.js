const WebSockets = require("ws"),
	Blockchain = require("./blockchain");

const {
	getNewestBlock,
	isBlockStructureValid,
	replaceChain,
	getBlockchain,
	addBlockToChain,
} = Blockchain;

const sockets = [];

// Messages Types
const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";

// Message Creators
const getLastest = () => {
	return {
		type: GET_LATEST,
		data: null
	};
};

const getAll = () => {
	return {
		type: GET_ALL,
		data: null
	};
};

const blockchainResponse = data => {
	return {
		type: BLOCKCHAIN_RESPONSE,
		data
	};
};

// p2p Server 시작
const startP2PServer = server => {
	const wsServer = new WebSockets.Server({ server });
	wsServer.on("connection", ws => {
		initSocketConnection(ws);
		handleSocketMessages(ws);
		handleSocketError(ws);
		sendMessage(ws, getLastest());
	});
	console.log("Yidacoin P2P Server Running!");
};

// socket connection 초기화
const initSocketConnection = ws => {
	sockets.push(ws);
	handleSocketMessages(ws);
	handleSocketError(ws);
	ws.on("message", data => {
		console.log(data);
	});
	// setTimeout(() => {
	//   ws.send("welcome!");
	// }, 5000);
};

// JSON 형식의 데이터인지 확인
const parseData = data => {
	try {
		return JSON.parse(data);
	} catch(e) {
		console.log(e);
		return null;
	}
};

// 메세지 핸들링
const handleSocketMessages = ws => {
	ws.on("message", data => {
		const message = parseData(data);

		// 메세지 형식 확인
		if(message === null) {
			return;
		}
		console.log(message);

		switch(message.type) {
		case GET_LATEST:
			sendMessage(ws, responseLatest());
			break;

		case GET_ALL:
			sendMessage(ws, responseAll());
			break;

		case BLOCKCHAIN_RESPONSE:
			const receivedBlocks = message.data;

			// null 체크
			if (receivedBlocks === null) {
				console.log("The receivedBlocks is null");
				break;
			}

			handleBlockchainResponse(receivedBlocks);
			break;
		}
	});
};

// blocks 처리 로직 ( 받은 체인의 길이가 길면 교체 )
const handleBlockchainResponse = receivedBlocks => {
	// blockchain 길이 검사
	if(receivedBlocks.length === 0) {
		console.log("Received blocks have a length of 0");
		return;
	}

	// 마지막 (최근 ) 블럭 유효성 검사
	const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
	if(!isBlockStructureValid(latestBlockReceived)) {
		console.log("The block structure of the block received is not valid");
		return;
	}

	// 마지만 (최근 ) 블럭 가져오기
	const newestBlock = getNewestBlock();
	if(newestBlock.hash === latestBlockReceived.previousHash) {
		// 한 블럭 차이
		addBlockToChain(latestBlockReceived);
	} else if(receivedBlocks.length === 1) {
		// 한개의 블럭밖에 없다면, 모든 블럭 추가
		sendMessageToAll(getAll());
	} else {
		// 블럭체인 변경
		replaceChain(receivedBlocks);
	}
};

// json 형식으로 메세지 전송
const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

// 연결된 socket 모두에게 메세지 전송
const sendMessageToAll = message => sockets.forEach(ws => sendMessage(ws, message));

// 마지막 ( 최근 ) 블럭 리턴
const responseLatest = () => blockchainResponse([getNewestBlock()]);

// 블럭체인 리턴
const responseAll = () => blockchainResponse(getBlockchain());

// 에러 핸들링
const handleSocketError = ws => {
	const closeSocketConnection = ws => {
		ws.close();
		sockets.splice(sockets.indexOf(ws), 1);
	};
	ws.on("close", () => closeSocketConnection(ws));
	ws.on("error", () => closeSocketConnection(ws));
};

// 연결 하기
const connectToPeers = newPeer => {
	const ws = new WebSockets(newPeer);
	ws.on("open", () => {
		initSocketConnection(ws);
	});
	ws.on("error", () => console.log("Connection failed"));
	ws.on("close", () => console.log("Connection failed"));
};

module.exports = {
	startP2PServer,
	connectToPeers
};
