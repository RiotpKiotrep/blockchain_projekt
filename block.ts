// block.ts

import * as crypto from 'crypto';
import {BlockData} from "./blockchain";

export interface Transaction {
    author: string;
    content: string;
}

export class Block {
    index: number;
    timestamp: number;
    transactions: Transaction[];
    previousHash: string;
    nonce: number;
    hash: string;

    constructor(
        index: number,
        transactions: Transaction[],
        previousHash: string,
        nonce: number = 0,
        timestamp: number = Date.now()
    ) {
        this.index = index;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = nonce;
        this.hash = this.computeHash();
    }

    computeHash(): string {
        const blockString = JSON.stringify(this.toDict());
        return crypto.createHash('sha256').update(blockString).digest('hex');
    }

    toDict(): Omit<BlockData, 'hash'> {
        return {
            index: this.index,
            timestamp: this.timestamp,
            transactions: this.transactions,
            previousHash: this.previousHash,
            nonce: this.nonce
            // Note: The hash is computed separately and not included here
        };
    }
}
