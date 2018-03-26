const _ = require("lodash"),
    Transactions = require("./transactions");

const { validateTx } = Transactions;

let mempool = [];

const getMempool = () => _.cloneDeep(mempool);

// pool 에 존재하는 transaction input 가져오기
const getTxInsInPool = mempool => {
    return _(mempool).map(tx => tx.txIns).flatten().value();
};

// pool 에 추가할 transaction 인지 확인
const isTxValidForPool = (tx, mempool) => {
    const txInsInPool = getTxInsInPool(mempool);

    // 이미 pool 에 존재하는지 확인
    const isTxInAlreadyInPool = (txIns, txIn) => {
        return _.find(txIns, txInInPool => {
            return (
                txIn.txOutIndex === txInInPool.txOutIndex &&
                txIn.txOutId === txInInPool.txOutId
            );
        });
    };

    for(const txIn of tx.txIns) {
        if(isTxInAlreadyInPool(txInsInPool, txIn)) {
            // 이미 pool 에 존재하는 transaction input 이라면
            return false;
        }
    }

    return true;
};

// transaction intput 에 포함되어 있다면 (채굴 완료된 transaction 이라면)
const hasTxIn = (txIn, uTxOUtList) => {
    const foundTxIn = uTxOUtList.find(uTxOut => uTxOut.txOutId === txIn.txOutId && uTxOut.txOutIndex === txIn.txOutIndex);
    return foundTxIn !== undefined;
};

// memPool 갱신
const updateMempool = uTxOutList => {
    const invalidTxs = [];
    for(const tx of mempool) {
        for(const txIn of tx.txIns) {
            if(!hasTxIn(txIn, uTxOutList)) {
                // 채굴 완료된 transaction
                invalidTxs.push(tx);
                break;
            }
        }
    }

    if(invalidTxs.length > 0) {
        mempool = _.without(mempool, ...invalidTxs);
    }
};

// memPool 에 추가
const addToMempool = (tx, uTxOutList) => {
    if(!validateTx(tx, uTxOutList)) {
        throw Error("This tx is invalid. Will not add it to pool");
    } else if(!isTxValidForPool(tx, mempool)) {
        throw Error("This tx is not valid for the pool. Will not add it.");
    }

    mempool.push(tx);
};

module.exports = {
    addToMempool,
    getMempool,
    updateMempool
};