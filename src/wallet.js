const elliptic = require("elliptic"),
    path = require("path"),
    fs = require("fs"),
    _ = require("lodash"),
    Transactions = require("./transactions");

const {getPublicKey, getTxId, signTxIn, TxIn, Transaction, TxOut} = Transactions;

const ec = new elliptic.ec("secp256k1");

const privateKeyLocation = path.join(__dirname, "privateKey");

// private key 생성
const generatePrivateKey = () => {
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};

// private key 가져오기
const getPrivateFromWallet = () => {
    const buffer = fs.readFileSync(privateKeyLocation, "utf-8");
    return buffer.toString();
};

// public key 가져오기
const getPublicFromWallet = () => {
    const privateKey = getPrivateFromWallet();
    const key = ec.keyFromPrivate(privateKey, "hex");
    return key.getPublic().encode("hex");
};

// balance 가져오기
const getBalance = (address, uTxOuts) => {
    return _(uTxOuts).filter(uTxO => uTxO.address === address).map(uTxO => uTxO.amount).sum();
};

// wallet 초기화
const initWallet = () => {
    if (fs.existsSync(privateKeyLocation)) {
        return;
    }

    const newPrivateKey = generatePrivateKey();

    fs.writeFileSync(privateKeyLocation, newPrivateKey);
};

// 사용할 수 있는 balance
const findAmountInUTxOuts = (amountNeeded, myUTxOuts) => {
    let currentAmount = 0;
    const includedUTxOuts = [];

    for (const myUTxOut of myUTxOuts) {
        includedUTxOuts.push(myUTxOut);
        currentAmount = currentAmount + myUTxOut.amount;

        if (currentAmount >= amountNeeded) {
            const leftOverAmount = currentAmount - amountNeeded;
            return {includedUTxOuts, leftOverAmount};
        }
    }

    throw Error("Not enough founds");
    // return false;
};

// transaction output 생성
const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
    const receiverTxOut = new TxOut(receiverAddress, amount);

    if (leftOverAmount === 0) {
        return [receiverTxOut];
    } else {
        const leftOverTxOut = new TxOut(myAddress, leftOverAmount);
        return [receiverTxOut, leftOverTxOut];
    }
};

// memPool 에 존재하는 utxo 가져오기 ( 나의 utxo 제외 )
const filterUTxOutsFromMempool = (uTxOutList, mempool) => {
    const txIns = _(mempool).map(tx => tx.txIns).flatten().value();
    console.log("txIns : " + JSON.stringify(txIns).toString());

    const removables = [];
    for(const uTxOut of uTxOutList) {
        const txIn = _.find(txIns, txIn => txIn.txOutIndex === uTxOut.txOutIndex && txIn.txOutId === uTxOut.txOutId);
        console.log("txIn : " + JSON.stringify(txIn));

        if(txIn !== undefined) {
            removables.push(uTxOut);
        }
    }

    return _.without(uTxOutList, ...removables);
};

// transaction 생성
const createTx = (receiverAddress, amount, privateKey, uTxOutList, mempool) => {
    const myAddress = getPublicKey(privateKey);
    const myUTxOuts = uTxOutList.filter(uTxO => uTxO.address === myAddress);

    const filteredUTxOuts = filterUTxOutsFromMempool(myUTxOuts, mempool);
    console.log("filteredUTxOuts : " + JSON.stringify(filteredUTxOuts).toString());

    const {includedUTxOuts, leftOverAmount} = findAmountInUTxOuts(amount, filteredUTxOuts);

    const toUnsignedTxIn = uTxOut => {
        const txIn = new TxIn();
        txIn.txOutId = uTxOut.txOutId;
        txIn.txOutIndex = uTxOut.txOutIndex;
        return txIn;
    };

    // transaction 에 사용할 utxo 를 가지고 옴
    const unsignedTxIns = includedUTxOuts.map(toUnsignedTxIn);

    const tx = new Transaction();

    tx.txIns = unsignedTxIns;
    tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
    tx.id = getTxId(tx);

    // sign inputs
    tx.txIns = tx.txIns.map((txIn, index) => {
        txIn.signature = signTxIn(tx, index, privateKey, uTxOutList);
        return txIn;
    });

    return tx;
};

module.exports = {
    initWallet,
    getBalance,
    getPublicFromWallet,
    getPrivateFromWallet,
    createTx
};