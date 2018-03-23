const elliptic = require("elliptic"),
    path = require("path"),
    fs = require("fs"),
    _ = require("lodash"),
    Transactions = require("./transactions");

const { getPublicKey, getTxId, signTxIn, TxIn, Transaction, TxOut } = Transactions;

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
    if(fs.existsSync(privateKeyLocation)) {
        return;
    }

    const newPrivateKey = generatePrivateKey();

    fs.writeFileSync(privateKeyLocation, newPrivateKey);
};

// 사용할 수 있는 balance
const findAmountInUTxOuts = (amountNeeded, myUTxOuts) => {
    let currentAmount = 0;
    const includedUTxOuts = [];

    for(const myUTxOut of myUTxOuts) {
        includedUTxOuts.push(myUTxOut);
        currentAmount = currentAmount + myUTxOut.amount;

        if(currentAmount >= amountNeeded) {
            const leftOverAmount = currentAmount - amountNeeded;
            return { includedUTxOuts, leftOverAmount };
        }
    }

    console.log("Not enough founds");
    return false;
};

// transaction output 생성
const createTxOut = (receiverAddress, myAddress, amount, leftOverAmount) => {
    const receiverTxOut = new TxOut(receiverAddress, amount);

    if(leftOverAmount === 0) {
        return [receiverTxOut];
    } else {
        const leftOverTxOut = new TxOut(myAddress, leftOverAmount);
        return [receiverTxOut, leftOverTxOut];
    }
};

// transaction 생성
const createTx = (receiverAddress, amount, privateKey, uTxOutList) => {
    const myAddress = getPublicKey(privateKey);
    const myUTxOuts = uTxOutList.filter(uTxO => uTxO.address === myAddress);

    const { includedUTxOuts, leftOverAmount } = findAmountInUTxOuts(amount, myUTxOuts);

    const toUnsignedTxIn = uTxOut => {
        const txIn = new TxIn();
        txIn.txOutId = uTxOut.txOutId;
        txIn.txOutIndex = uTxOut.txOutIndex;
    };

    // transaction 에 사용할 utxo 를 가지고 옴
    const unsignnedTxIns = includedUTxOuts.map(toUnsignedTxIn);

    const tx = new Transaction();

    tx.txIns = unsignnedTxIns;
    tx.txOuts = createTxOut(receiverAddress, myAddress, amount, leftOverAmount);
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
    getPublicFromWallet
};