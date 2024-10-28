import { Block, Transaction } from './block';
import * as crypto from 'crypto';
import axios from 'axios';

export interface BlockData {
    index: number;
    timestamp: number;
    transactions: Transaction[];
    previousHash: string;
    nonce: number;
    hash: string;
}

export class Blockchain {
    chain: Block[];
    // Transakcje które zostaną dodane do następnego bloku
    unconfirmedTransactions: Transaction[];
    difficulty: number;

    // Sets to track processed transactions and blocks to prevent rebroadcasting
    processedTransactions: Set<string>;
    processedBlocks: Set<string>;

    constructor() {
        this.chain = [];
        this.unconfirmedTransactions = [];
        this.difficulty = 4; // Adjust difficulty as needed, around 65k nounce is needed

        this.processedTransactions = new Set<string>();
        this.processedBlocks = new Set<string>();

        this.createGenesisBlock();
    }

    createGenesisBlock(): void {
        const genesisBlock = new Block(0, [], "0");
        this.chain.push(genesisBlock);
        this.processedBlocks.add(genesisBlock.hash); // Add genesis block hash to processedBlocks
    }

    getLastBlock(): Block {
        return this.chain[this.chain.length - 1];
    }

    addTransaction(transaction: Transaction): void {
        // Hash is used to identify transactions, preventing duplicates
        const txHash = this.computeTransactionHash(transaction);
        if (!this.processedTransactions.has(txHash)) {
            this.unconfirmedTransactions.push(transaction);
            this.processedTransactions.add(txHash); // Mark transaction as processed
        }
    }

    // Compute hash of a transaction
    computeTransactionHash(transaction: Transaction): string {
        return crypto.createHash('sha256').update(JSON.stringify(transaction)).digest('hex');
    }

    // Proof of work algorithm - find nounce that satisfies the difficulty level
    proofOfWork(block: Block): string {
        block.nonce = 0;
        let computedHash = block.computeHash();
        // Number of 0 at the beginning of the hash
        const target = '0'.repeat(this.difficulty);
        while (!computedHash.startsWith(target)) {
            block.nonce += 1;
            computedHash = block.computeHash();
        }
        console.log('Nonce:', block.nonce);
        return computedHash;
    }

    addBlock(block: Block, proof: string): boolean {
        const lastBlock = this.getLastBlock();

        // Check if the block's previous hash is equal to the hash of the last block
        if (lastBlock.hash !== block.previousHash) {
            return false;
        }

        // Check if the proof is valid - hash of the block starts with required number of 0s
        if (!this.isValidProof(block, proof)) {
            return false;
        }

        block.hash = proof;
        this.chain.push(block);
        console.log('Dodano nowy blok:', block.toDict());
        this.processedBlocks.add(block.hash); // Mark block as processed

        return true;
    }

    isValidProof(block: Block, blockHash: string): boolean {
        const target = '0'.repeat(this.difficulty);
        return (
            blockHash.startsWith(target) &&
            blockHash === block.computeHash()
        );
    }

    mine(): number | false {
        if (this.unconfirmedTransactions.length === 0) {
            return false;
        }

        const lastBlock = this.getLastBlock();
        const newBlock = new Block(
            lastBlock.index + 1,
            this.unconfirmedTransactions,
            lastBlock.hash
        );
        const proof = this.proofOfWork(newBlock);

        if (this.addBlock(newBlock, proof)) {
            this.unconfirmedTransactions = [];
            return newBlock.index;
        }
        return false;
    }

    getChain(): Omit<BlockData, 'hash'>[] {
        return this.chain.map(block => block.toDict());
    }

    // Funkcje poniżej do sprawdzenia czy się nie powtarzają i czy są poprawne - zapewne nie
    isValidChain(chain: BlockData[]): boolean {
        if (chain.length === 0) return false;
        if (chain[0].previousHash !== "0") return false;
        for (let i = 1; i < chain.length; i++) {
            const currentBlock = chain[i];
            const previousBlock = chain[i - 1];
            if (currentBlock.previousHash !== previousBlock.hash) return false;
            if (currentBlock.hash !== this.calculateHash(currentBlock)) return false;
            if (!currentBlock.hash.startsWith('0'.repeat(this.difficulty))) return false;
        }
        return true;
    }

    calculateHash(block: BlockData): string {
        const blockString = JSON.stringify({
            index: block.index,
            timestamp: block.timestamp,
            transactions: block.transactions,
            previousHash: block.previousHash,
            nonce: block.nonce
        });
        return crypto.createHash('sha256').update(blockString).digest('hex');
    }

    async resolveConflicts(peers: string[]): Promise<boolean> {
        let newChain: BlockData[] | null = null;
        let minHashValue: number | null = null;

        for (const peer of peers) {
            try {
                const response = await axios.get<BlockData[]>(`${peer}/chain`);
                const chain = response.data;
                if (this.isValidChain(chain)) {
                    const lastBlock = chain[chain.length - 1];
                    const hashValue = parseInt(lastBlock.hash, 16);
                    if (minHashValue === null || hashValue < minHashValue) {
                        minHashValue = hashValue;
                        newChain = chain;
                    }
                }
            } catch (error: any) {
                console.log(`Błąd podczas pobierania łańcucha z peer ${peer}: ${error.message}`);
            }
        }

        if (newChain && newChain.length > this.chain.length) {
            this.chain = newChain.map(blockData => {
                const block = new Block(
                    blockData.index,
                    blockData.transactions,
                    blockData.previousHash,
                    blockData.nonce,
                    blockData.timestamp
                );
                block.hash = blockData.hash;
                this.processedBlocks.add(block.hash); // Add to processedBlocks
                // Also add transactions to processedTransactions to prevent rebroadcast
                block.transactions.forEach(tx => {
                    const txHash = this.computeTransactionHash(tx);
                    this.processedTransactions.add(txHash);
                });
                return block;
            });
            return true;
        }

        return false;
    }
}
