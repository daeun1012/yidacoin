const _ = require("lodash"),
    Transactions = require("./transactions");

const { validateTx } = Transactions;

let mempool = [];

// pool 에 존재하는 transaction input 가져오기
const getTxInsInPool = mempool => {
    return _(mempool).map(tx => tx.txIns).flatten().value();
};

// pool 에 추가할 transaction 인지 확인
const isTxValidForPool = (tx, mempool) => {
    const txInsInPool = getTxInsInPool(mempool);

    // 이미 pool 에 존재하는지 확인
    const isTxInAlreadyInPool = (txIns, txIn) => {
        return _.find(txIns, txInsInPool => {
            return (
                txIn.txOutIndex === txInsInPool.txOutIndex &&
                txIn.txOutId === txInsInPool.txOutId
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
    addToMempool
};