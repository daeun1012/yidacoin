const express = require("express"),
	bodyParser = require("body-parser"),
	morgan = require("morgan"),
	Blockchain = require("./blockchain"),
	Transactions = require("./transactions"),
	P2P = require("./p2p"),
    Mempool = require("./mempool"),
	Wallet = require("./wallet");

const { getBlockchain, createNewBlock, getAccountBalance, sendTx } = Blockchain;
const { startP2PServer, connectToPeers } = P2P;
const { initWallet } = Wallet;
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
		const newBlock = createNewBlock();
		res.send(newBlock);
	});

// p2p 소켓 연결
app.post("/peers", (req, res) => {
	const { body: { peer } } = req;
	connectToPeers(peer);
	res.send();
});

app.get("/me/balance", (req, res) => {
	const balance = getAccountBalance();
	res.send({ balance });
});

app.route("/transactions")
	.get((req, res) => {
        res.send(getMempool());
	})
	.post((req, res) => {
		try {
            const { body: { address, amount } } = req;
			if(address === undefined || amount === undefined) {
				throw Error("Please specify address and an amount");
			} else {
				const resPonse = sendTx(address, amount);
				res.send(resPonse);
			}
		} catch (e) {
			res.status(501).send(e.message);
		}
	});

// http 서버 구동
const server = app.listen(PORT, () =>
	console.log(`Yidacoin Server running on ${PORT}`)
);

// websocket 과 http 는 같은 포트에서 실행 가능
// 프로토콜이 다르며 충돌하지 않음
initWallet();
startP2PServer(server);
