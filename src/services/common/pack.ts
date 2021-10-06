import * as _ from 'lodash';

import config from '../../config/config';
import * as mongodb from '../../utils/mongodb';
import ipfs from './ipfs';
import accountService from '../accountService';

async function getPackTitle(
    pack: {
        auctionId?: number,
        bundleId?: number,
        gachaId?: number,
        ipfsHash: string,
        issuer: string
    },
) {
    return (await getPackMetadata(pack, '')).title;
}

async function getPackMetadata(
    pack: {
        auctionId?: number,
        bundleId?: number,
        gachaId?: number,
        ipfsHash: string,
        issuer: string
    },
    defaultSymbol: string,
    useIpfs = false,
): Promise<PackMetadata> {
    if (pack.ipfsHash.startsWith('Qm')) {
        if (useIpfs) {
            const metadata = await ipfs.getIpfsData(pack.ipfsHash);
            if (metadata === undefined) {
                return {
                    title: '',
                    description: '',
                    symbol: defaultSymbol,
                    creators: [pack.issuer],
                    decimals: 0,
                    isBooleanAmount: false,
                    shouldPreferSymbol: false,
                }
            } else {
                return metadata;
            }
        } else {
            const client = await mongodb.connectToDatabase();
            const database = client.db('akaSwap-DB');
            const collectionName = 
                pack.auctionId !== undefined ? 'auction-metadata' :
                pack.bundleId !== undefined ? 'bundle-metadata' :
                'gacha-metadata'
            const id =
                pack.auctionId !== undefined ? pack.auctionId :
                pack.bundleId !== undefined ? pack.bundleId :
                pack.gachaId !== undefined ? pack.gachaId : -1;
            const metadataCollection = database.collection(collectionName);
            const res = await metadataCollection.findOne({ id : id });
            if (res !== null && res.title !== '') {
                delete res._id;
                delete res.tokenId;
                delete res.ipfsHash;
                delete res.aliases;
                return res;
            } else {
                console.log(`get pack ${id} from ipfs`);
                const metadata = await getPackMetadata(pack, defaultSymbol, true);
                if (metadata?.title !== '') {
                    if (config.pinIpfs) {
                        ipfs.pinIpfsData(pack.ipfsHash);
                    }
                    await updatePackMetadata(collectionName, id, metadata);
                }
                return metadata;
            }
        }
    } else {
        return {
            title: pack.ipfsHash,
            description: pack.ipfsHash,
            symbol: defaultSymbol,
            creators: [pack.issuer],
            decimals: 0,
            isBooleanAmount: false,
            shouldPreferSymbol: false
        }
    }
}

async function updatePackMetadata(collectionName: string, id: number, metadata: PackMetadata) {
    const client = await mongodb.connectToDatabase();
    const database = client.db('akaSwap-DB');
    const filter = { id : id }
    const options = { upsert: false };
    const updateDoc = {
        $set: metadata,
    };
    const result = await database.collection(collectionName).updateOne(filter, updateDoc, options);
    if (result.modifiedCount > 0) {
        console.log(`Update metadata of pack #${id}`);
    }
}

export default {
    getPackTitle,
    getPackMetadata,
    updatePackMetadata,
}