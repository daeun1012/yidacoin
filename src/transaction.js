const CryptoJS = require("crypto-js"),
	elliptic = require("elliptic"),
	utils = require("./utils");

const ec = new elliptic.ec("secp256k1");

const COINBASE_AMOUNT = 50;

class TxOut {
	constructor(address, amount) {
		this.address = address;
		this.amount = amount;
	}
}

class TxIn {
    // txOutId
    // txOutIndex
    // Signature
}

class Transaction {
    // ID
    // txIns[]
    // txOuts[]
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

    // unspent out 소비 (unspent -> spent ( making new outputs ) )
    const spentTxOuts = newTx.map(tx => tx.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map(txIn => new UTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

    const resultingUTxOuts = uTxOutList.filter(uTxO => !findUTxOut(uTxO.txOutId, uTxO.txOutIndex, spentTxOuts)).concat(newUTxOuts);

    return resultingUTxOuts;
};

// transaction input 유효성 검사
const isTxInStructureValid = txIn => {
    if (txIn === null) {
        console.log("The txIn appears to be null");
        return false;
    } else if (typeof txIn.signature !== "string") {
        console.log("The txIn doesn't have a valid signature");
        return false;
    } else if (typeof txIn.txOutId !== "string") {
        console.log("The txIn doesn't have a valid txOutId");
        return false;
    } else if (typeof txIn.txOutIndex !== "number") {
        console.log("The txIn doesn't have a valid txOutIndex");
        return false;
    } else {
        return true;
    }
};

// 주소 유효성 검사
const isAddressValid = address => {
    if (address.length !== 130) {
        console.log("The address length is not the expected one");
        return false;
    } else if (address.match("^[a-fA-F0-9]+$") === null) {
        console.log("The address doesn't match the hex patter");
        return false;
    } else if (!address.startsWith("04")) {
        console.log("The address doesn't start with 04");
        return false;
    } else {
        return true;
    }
};

// transaction output 유효성 검사
const isTxOutStructureValid = txOut => {
    if (txOut === null) {
        return false;
    } else if (typeof txOut.address !== "string") {
        console.log("The txOut doesn't have a valid string as address");
        return false;
    } else if (!isAddressValid(txOut.address)) {
        console.log("The txOut doesn't have a valid address");
        return false;
    } else if (typeof txOut.amount !== "number") {
        console.log("The txOut doesn't have a valid amount");
        return false;
    } else {
        return true;
    }
};

// transaction 유효성 검사
const isTxStructureValid = tx => {
    if (typeof tx.id !== "string") {
        console.log("Tx ID is not valid");
        return false;
    } else if (!(tx.txIns instanceof Array)) {
        console.log("The txIns are not an array");
        return false;
    } else if (!tx.txIns.map(isTxInStructureValid).reduce((a, b) => a && b, true)) {
        console.log("The structure of one of the txIn is not valid");
        return false;
    } else if (!(tx.txOuts instanceof Array)) {
        console.log("The txOuts are not an array");
        return false;
    } else if (!tx.txOuts.map(isTxOutStructureValid).reduce((a, b) => a && b, true)) {
        console.log("The structure of one of the txOut is not valid");
        return false;
    } else {
        return true;
    }
};

// transaction input 검사
const validateTxIn = (txIn, tx, uTxOutList) => {
    const wantedTxOut = uTxOutList.find(uTxOut => uTxOut.txOutId === txIn.txOutId && uTxOut.txOutIndex === txIn.txOutIndex);
    if(wantedTxOut === null) {
        return false;
    } else {
        // signing 확인
        const address = wantedTxOut.address;
        const key = ec.keyFromPublic(address, "hex");
        return key.verify(tx.id, txIn.signature);
    }
};

const getAmountInTxIn = (txIn, uTxOutList) => findUTxOut(txIn.txOutId, txIn.txOutId, uTxOutList).amount;


// transaction 유효성 검사
const validateTx = (tx, uTxOutList) => {

    if(!isTxStructureValid(tx)) {
        return false;
    }

    if(getTxId(tx) !== tx.id) {
        return false;
    }

    const hasValidTxIns = tx.txIns.map(txIn => validateTxIn(txIn, tx, uTxOutList));

    if(!hasValidTxIns) {
        return false;
    }

    // input, output amount 확인
    const amountInTxIns = tx.txIns.map(txIn => getAmountInTxIn(txIn, uTxOutList).reduce((a, b) => a + b, 0));

    const amountInTxOuts = tx.txOuts.map(txOut => txOut.amount).reduce((a, b) => a + b, 0);

    if(amountInTxIns !== amountInTxOuts) {
        return false;
    } else {
        return true;
    }
};

// coinbase transaction 유효성 검사
const validateCoinbaseTx = (tx, blockIndex) => {
    if(getTxId(tx) !== tx.id) {
        return false;
    } else if(tx.txIns.length !== 1) {
        return false;
    } else if(tx.txIns[0].txOutIndex !== blockIndex) {
        return false;
    } else if(tx.txOuts.length !== 1) {
        return false;
    } else if(tx.txOuts[0].amount !== COINBASE_AMOUNT) {
        return false;
    } else {
        return true;
    }
};
