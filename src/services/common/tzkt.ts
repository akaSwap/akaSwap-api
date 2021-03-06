import axios from 'axios'
import * as _ from 'lodash'

import config from '../../config/config'

async function getBigMapContent(bigMapId: number, key: string) {
    const url = `${config.tzktServer}/v1/bigmaps/${bigMapId}/keys/${key}`;
    return (await axios.get<any>(url)).data;
}

async function getContractStorage(address: string, level = 0) {
    let url = `${config.tzktServer}/v1/contracts/${address}/storage`;
    if (level > 0) {
        url += `?level=${level}`
    }
    return (await axios.get<any>(url)).data;
}

async function getTransactionGroup(hash: string) {
    let url = `${config.tzktServer}/v1/operations/transactions/${hash}`;
    return (await axios.get<any>(url)).data;
}

export default {
    getBigMapContent,
    getContractStorage,
    getTransactionGroup,
}