import axios from 'axios';
import * as formidable from 'formidable';
import { createReadStream } from 'fs';
import { create } from 'ipfs-http-client';
import * as _ from 'lodash';

import config from '../../config/config';

async function getIpfsData(ipfsHash: string) {
    let res = await axios.get(`${config.localIpfsUrl}/ipfs/` + ipfsHash, { timeout: 1000 }).catch(e => e);
    if (res.data === undefined) {
        res = await axios.get('https://infura-ipfs.io/ipfs/' + ipfsHash, { timeout: 1000 }).catch(e => e);
    }
    if (res.data === undefined) {
        res = await axios.get('https://dweb.link/ipfs/' + ipfsHash, { timeout: 1000 }).catch(e => e);
    }
    if (res.data === undefined) {
        res = await axios.get('https://cloudflare-ipfs.com/ipfs/' + ipfsHash, { timeout: 1000 }).catch(e => e);
    }
    return res.data;
}

async function pinIpfsData(ipfsHash: string) {
    const url = `https://api.pinata.cloud/pinning/pinByHash`;
    const body = {
        hashToPin: ipfsHash,
        pinataMetadata: {
            name: config.pinataMetadataName
        }
    };
    return axios
        .post(url, body, {
            headers: {
                pinata_api_key: config.pinataApiKey,
                pinata_secret_api_key: config.pinataSecretApiKey
            }
        })
        .then((response) => {
            //handle response here
            console.log(`Pin ${ipfsHash} success`);
        })
        .catch((error) => {
            //handle error here
            console.log(`Pin ${ipfsHash} error`);
        });
}

async function addDataToLocalIpfs(files: formidable.File[]) {
    const ipfsClient = await create();
    const data = files.map((file) => {
        const path = file.name === null ? '' : file.name;
        return { path: decodeURIComponent(path), content: createReadStream(file.path) };
    });
    for await (const result of ipfsClient.addAll(data, { pin: false, wrapWithDirectory: (data.length > 1) })) {
        console.log(`add ${result.cid} to local ipfs`);
    }
}

export default {
    getIpfsData,
    pinIpfsData,
    addDataToLocalIpfs,
}