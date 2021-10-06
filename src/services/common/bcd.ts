import axios from 'axios'
import * as _ from 'lodash'

import config from '../../config/config'

async function getTransfersOfContractByTokenId(contract: string, tokenId: number) {
    const url =
        `${config.bcdServer}/v1/tokens/${config.bcdNetwork}/transfers/${contract}` +
        `?sort=asc&token_id=${tokenId}`;

    let data = (await axios.get(url)).data;
    const total = data.total;
    let transfers = data.transfers;

    let prevLength = 0;
    let prevLastId = 0;
    while (transfers.length < total) {
        if (transfers.length === prevLength) {
            break;
        }
        prevLength = transfers.length;
        let lastId = parseInt(data.last_id);
        if (lastId !== prevLastId) {
            prevLastId = lastId;
            lastId -= 1;
        }
        data = (await axios.get(url + `&last_id=${lastId}`)).data;
        transfers = _.unionWith(transfers, data.transfers, _.isEqual);
    }

    if (transfers.length !== total) {
        console.error(`Cannot get complete records of ${contract} for #${tokenId}. (${transfers.length}/${total})`);
    }

    return transfers;
}

async function getMetadataByTokenId(tokenId: number) {
    const url =
        `${config.bcdServer}/v1/tokens/${config.bcdNetwork}/metadata` +
        `?contract=${config.akaNftContract}&token_id=${tokenId}`;

    const data = (await axios.get(url)).data;
    return (data.length === 0) ? null : data[0];
}

async function getTransfersByUserAddress(address: string, lastId = 0) {
    let url =
        `${config.bcdServer}/v1/tokens/${config.bcdNetwork}/transfers/${address}` +
        `?contracts=${config.akaNftContract}&sort=asc`;
    if (lastId > 0) {
        url += `&last_id=${lastId}`;
    }
    return (await axios.get(url)).data;
}

async function getTransfersByUserAddressWithTokenId(address: string, tokenId: number) {
    const url =
        `${config.bcdServer}/v1/tokens/${config.bcdNetwork}/transfers/${address}` +
        `?contracts=${config.akaNftContract}&token_id=${tokenId}&sort=asc`;

    let data = (await axios.get(url)).data;
    const total = data.total;
    let transfers = data.transfers;

    let prevLength = 0;
    let prevLastId = 0;
    while (transfers.length < total) {
        if (transfers.length === prevLength) {
            break;
        }
        prevLength = transfers.length;
        let lastId = parseInt(data.last_id);
        if (lastId !== prevLastId) {
            prevLastId = lastId;
            lastId -= 1;
        }
        data = (await axios.get(url + `&last_id=${lastId}`)).data;
        transfers = _.unionWith(transfers, data.transfers, _.isEqual);
    }

    if (transfers.length !== total) {
        console.error(`Cannot get complete records of ${address} with #${tokenId}. (${transfers.length}/${total})`);
    }

    return transfers;
}

async function getBigMapDiff(bigMapId: number, keyHash: string) {
    const url =
        `${config.bcdServer}/v1/bigmap/${config.bcdNetwork}/${bigMapId}/keys/${keyHash}`;
    return (await axios.get(url)).data;
}

async function getContractStorage(contract: string, level = 0) {
    let url =
        `${config.bcdServer}/v1/contract/${config.bcdNetwork}/${contract}/storage`;
    if (level > 0) {
        url += `?level=${level}`
    }
    return (await axios.get(url)).data;
}

async function getTokenCount() {
    const data = await getContractStorage(config.akaNftContract);
    return parseInt(data[0].children[1].value);
}

export default {
    getTransfersOfContractByTokenId,
    getMetadataByTokenId,
    getTransfersByUserAddress,
    getTransfersByUserAddressWithTokenId,
    getBigMapDiff,
    getContractStorage,
    getTokenCount,
}