const express = require("express"),
	_ = require("lodash"),
	bodyParser = require("body-parser"),
	morgan = require("morgan"),
	Blockchain = require("./blockchain"),
	P2P = require("./p2p"),
	Mempool = require("./mempool"),
	Wallet = require("./wallet");

const { getBlockchain, createNewBlock, getAccountBalance, sendTx, getUTxOutList } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet, getPublicFromWallet, getBalance } = Wallet;
const { getMempool } = Mempool;

const PORT = process.env.HTTP_PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(morgan("combined"));

app.route("/blocks")
	.get((req, res) => {
		// 블럭 조회
		res.send(getBlockchain());
	})
	.post((req, res) => {
		// 블럭 mining
		const newBlock = createNewBlock();
		res.send(newBlock);
	});

// p2p 소켓 연결
app.post("/peers", (req, res) => {
	const { body: { peer } } = req;
	connectToPeers(peer);
	res.send();
});

// 잔고 조회
app.get("/me/balance", (req, res) => {
	const balance = getAccountBalance();
	res.send({ balance });
});

// 주소 조회
app.get("/me/address", (req, res) => {
	res.send(getPublicFromWallet());
});

// 블럭 조회 (해시)
app.get("/blocks/:hash", (req, res) => {
	const { params: { hash } } = req;
	const block = _.find(getBlockchain(), { hash });
	if (block === undefined) {
		res.status(400).send("Block not found");
	} else {
		res.send(block);
	}
});

// transaction 조회
app.get("/transactions/:id", (req, res) => {
	console.log("req.params.id : " + req.params.id);
	const tx = _(getBlockchain())
		.map(blocks => blocks.data)
		.flatten()
		.find({ id: req.params.id });

	if (tx === undefined) {
		// transaction 이 존재 하지 않는다.
		res.status(400).send("Transaction not found");
	}

	res.send(tx);
});

app.route("/transactions")
	.get((req, res) => {
		// mining 이 안된 transaction 조회 ( mempool 조회 )
		res.send(getMempool());
	})
	.post((req, res) => {
		// transaction 생성
		try {
			const { body: { address, amount } } = req;
			if (address === undefined || amount === undefined) {
				throw Error("Please specify address and an amount");
			} else {
				const resPonse = sendTx(address, amount);
				res.send(resPonse);
			}
		} catch (e) {
			res.status(501).send(e.message);
		}
	});

// 주소 잔고 조회
app.get("/address/:address", (req, res) => {
	const { params: { address } } = req;
	const balance = getBalance(address, getUTxOutList());
	res.send({ balance });
});

// http 서버 구동
const server = app.listen(PORT, () =>
	console.log(`Yidacoin Server running on ${PORT}`)
);

// 지갑 초기화
initWallet();

// websocket 과 http 는 같은 포트에서 실행 가능
// 프로토콜이 다르며 충돌하지 않음
startP2PServer(server);
