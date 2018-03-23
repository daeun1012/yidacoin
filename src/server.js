const express = require("express"),
	bodyParser = require("body-parser"),
	morgan = require("morgan"),
	Blockchain = require("./blockchain"),
	P2P = require("./p2p"),
	Wallet = require("./wallet");

const { getBlockchain, createNewBlock } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet } = Wallet;

const PORT = process.env.HTTP_PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(morgan("combined"));

// 블럭 조회
app.get("/blocks", (req, res) => {
	res.send(getBlockchain());
});

// 새로운 블럭 생성 ( mining )
app.post("/blocks", (req, res) => {
	const { body: { data } } = req;
	const newBlock = createNewBlock(data);
	res.send(newBlock);
});

// p2p 소켓 연결
app.post("/peers", (req, res) => {
	const { body: { peer } } = req;
	connectToPeers(peer);
	res.send();
});

// http 서버 구동
const server = app.listen(PORT, () =>
	console.log(`Yidacoin Server running on ${PORT}`)
);

// websocket 과 http 는 같은 포트에서 실행 가능
// 프로토콜이 다르며 충돌하지 않음
initWallet();
startP2PServer(server);
