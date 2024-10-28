import axios, { AxiosResponse } from 'axios';

const nodeAddress: string | undefined = process.argv[2];
const peerAddresses: string[] = process.argv.slice(3);

if (!nodeAddress) {
    console.log('Użycie: node miner.ts <NODE_ADDRESS> [PEER_ADDRESS1 PEER_ADDRESS2 ...]');
    process.exit(1);
}

// Register the node with the peers
const registerWithPeers = async (): Promise<void> => {
    for (const peer of peerAddresses) {
        try {
            await axios.post(`${peer}/register_node`, { node_address: nodeAddress });
            console.log(`Zarejestrowano node'a w peer ${peer}`);
        } catch (error: any) {
            console.log(`Nie można zarejestrować node'a w peer ${peer}: ${error.message}`);
        }
    }
};


const mine = async (): Promise<void> => {
    // Continuously mine new blocks or listen for new transactions
    while (true) {
        try {
            const response: AxiosResponse = await axios.get(`${nodeAddress}/mine`);
            console.log(response.data);
        } catch (error: any) {
            console.log(`Błąd podczas mining: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before the next attempt
    }
};

// If peer addresses are provided, register with peers before starting to mine
if (peerAddresses.length > 0) {
    registerWithPeers().then(() => {
        mine();
    });
} else {
    mine();
}
