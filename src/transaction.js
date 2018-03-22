const CryptoJS = require("crypto-js"),
	elliptic = require("elliptic"),
	utils = require("./utils");

const ec = new elliptic.ec("secp256k1");

class TxOut {
	constructor(address, amount) {
		this.address = address;
		this.amount = amount;
	}
}

class TxIn {

}

class Transaction {

}

// unspent transaction output
class UTxOut {
	constructor(txOutId, txOutIndex, address, amount) {
		this.txOutId = txOutId;
		this.txOutIndex = txOutIndex;
		this.address = address;
		this.amount = amount;
	}
}

// unspent outputs
let uTxOuts = [];

// transaction id 생성
const getTxId = tx => {
	const txInContent = tx.txIns.map(txIn => txIn.txOutId + txIn.txOutIndex).reduce((a, b) => a + b, "");
	const txOutContent = tx.txOuts.map(txOut => txOut.address + txOut.amount).reduce((a, b) => a + b, "");
	return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

// unspent transaction output 리턴
const findUTxOut = (txOutId, txOutIndex, uTxOutList) => {
	return uTxOutList.find(uTxOut => uTxOut.txOutId === txOutId && uTxOut.txOutIndex === txOutIndex);
};

// transaction input signing
const signTxIn = (tx, txInIndex, privateKey, uTxOut) => {
	const txIn = tx.txIns[txInIndex];
	const dataToSign = tx.id;
	const referencedUTxOut = findUTxOut(txIn.txOutId, txIn.txOutIndex, uTxOuts);
	if(referencedUTxOut === null) {
    	return;
	}

	const key = ec.keyFromPrivate(privateKey, "hex");
	const signature = utils.toHexString(key.sign(dataToSign).toDER());
	return signature;
};

const updateUTxOuts = (newTx, uTxOutList) => {
    const newTxOuts = newTx.map(tx => {
        tx.txOuts.map(
            (txOut, index) => {
                new UTxOut(tx.txOutId, index, txOut.address, txOut.amount);
            }
        )
    }).reduce((a, b) => a.concat(b), []);

    const spentTxOuts = newTx.map(tx => tx.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

    const resultingUTxOuts = uTxOutList.filter(uTxO => !findUTxOut(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts))
};