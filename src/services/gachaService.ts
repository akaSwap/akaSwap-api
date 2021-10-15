import axios from 'axios';
import * as conseiljs from 'conseiljs';
import * as _ from 'lodash';

import config from '../config/config';
import utils from '../utils/utils';
import pack from './common/pack';
import pattern from './common/pattern';
import tzkt from './common/tzkt';
import accountService from './accountService';
import akaObjService from './akaObjService';

function getMakeGachaParametersRegExp(blockLevel: number) {
    for (let i = pattern.makeGachaParametersRegExps.length - 1; i >= 0; --i) {
        if (blockLevel >= config.akaGachaBlockLevel[i]) {
            return pattern.makeGachaParametersRegExps[i];
        }
    }
    return pattern.makeGachaParametersRegExps[0];
}

function getAkaGachaAddress({gachaId = -1, blockLevel = -1, timestamp = -1, playId = -1}) {
    for (let i = config.akaGacha.length - 1; i >= 0; --i) {
        if (gachaId >= config.akaGachaId[i] ||
            blockLevel >= config.akaGachaBlockLevel[i] ||
            timestamp >= config.akaGachaTimestamp[i] ||
            playId >= config.akaGachaPlayId[i]
        ) {
            return config.akaGacha[i];
        }
    }
    return config.akaGacha[0];
}

function getNftGachaMap({gachaId = -1, blockLevel = -1, timestamp = -1, playId = -1}) {
    for (let i = config.nftGachaMap.length - 1; i >= 0; --i) {
        if (gachaId >= config.akaGachaId[i] ||
            blockLevel >= config.akaGachaBlockLevel[i] ||
            timestamp >= config.akaGachaTimestamp[i] ||
            playId >= config.akaGachaPlayId[i]
        ) {
            return config.nftGachaMap[i];
        }
    }
    return config.nftGachaMap[0];
}

function getNftGachaPlayMap({gachaId = -1, blockLevel = -1, timestamp = -1, playId = -1}) {
    for (let i = config.nftGachaPlayMap.length - 1; i >= 0; --i) {
        if (gachaId >= config.akaGachaId[i] ||
            blockLevel >= config.akaGachaBlockLevel[i] ||
            timestamp >= config.akaGachaTimestamp[i] ||
            playId >= config.akaGachaPlayId[i]
        ) {
            return config.nftGachaPlayMap[i];
        }
    }
    return config.nftGachaPlayMap[0];
}

async function getGacha(gachaId: number): Promise<Gacha | null> {
    const gachaMap = getNftGachaMap({gachaId: gachaId});
    let gachaQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    gachaQuery = conseiljs.ConseilQueryBuilder.addFields(
        gachaQuery,
        'key',
        'value'
    );
    gachaQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        gachaQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [gachaMap]
    );
    gachaQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        gachaQuery,
        'key',
        conseiljs.ConseilOperator.EQ,
        [gachaId]
    );
    gachaQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        gachaQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    );
    gachaQuery = conseiljs.ConseilQueryBuilder.setLimit(gachaQuery, 1);

    const gachaResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        gachaQuery
    );

    try {
        const row = gachaResult[0];
        const match = pattern.gachaStorageRegExp.exec(row['value']);

        if (match?.some) {
            let gachaTotal = 0;
            const gachaId = parseInt(row['key']);
            const items = match[3].split(' ; ');
            const lastPrizeId = parseInt(match[7]);
            const issuer = conseiljs.TezosMessageUtils.readAddress(match[6]);

            const [gachaItems, lastPrizeObjIpfsHash] = await Promise.all([
                Promise.all(items.map(async (item) => {
                    const data = item.split(' ');
                    const total = parseInt(data[4].substr(0, data[4].length - 1));
                    const id = parseInt(data[1]);
                    gachaTotal += total;
                    return {
                        tokenId: id,
                        remain: parseInt(data[3]),
                        total: total,
                        ipfsHash: await akaObjService.getAkaObjIpfsHash(id),
                    }
                })),
                akaObjService.getAkaObjIpfsHash(lastPrizeId)
            ]);
            return {
                gachaId: gachaId,
                cancelTime: parseInt(match[1]),
                gachaAmount: parseInt(match[2]),
                gachaTotal: gachaTotal,
                gachaPlayRemains: parseInt(match[4]),
                issueTime: parseInt(match[5]),
                issuer: issuer,
                alias: (await accountService.getAccountAliases([issuer]))[0],
                gachaItems: gachaItems,
                lastPrizeTokenId: lastPrizeId,
                lastPrize: {
                    tokenId: lastPrizeId,
                    ipfsHash: lastPrizeObjIpfsHash,
                },
                metadata: await pack.getPackMetadata({ gachaId, ipfsHash: match[8], issuer }, 'GachaBundle'),
                xtzPerGacha: parseInt(match[9]),
            };
        }
    } catch (error) {
        console.log(`failed to get gacha by ${gachaId} with ${error}`);
    }

    return null;
}

/**
 * Returns gachas. Since some days ago.
 * All: address = '', Issuer address = 'tz...'.
 */
async function getGachas(address: string, days = 0): Promise<Gacha[]> {
    let gachasQuery = conseiljs.ConseilQueryBuilder.blankQuery()
    gachasQuery = conseiljs.ConseilQueryBuilder.addFields(
        gachasQuery,
        'key',
        'value'
    )
    gachasQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        gachasQuery,
        'big_map_id',
        config.nftGachaMap.length > 1
            ? conseiljs.ConseilOperator.IN
            : conseiljs.ConseilOperator.EQ,
        config.nftGachaMap
    )
    if (days > 0) {
        const now = Date.now();
        gachasQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            gachasQuery,
            'timestamp',
            conseiljs.ConseilOperator.BETWEEN,
            [utils.subtractDays(now, days), now]
        )
    }
    gachasQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        gachasQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    )
    gachasQuery = conseiljs.ConseilQueryBuilder.setLimit(gachasQuery, 100000);
    
    // Pair (Pair 1623148475 61) (Pair { Elt 0 (Pair 30 30) ; Elt 1 (Pair 1 1) ; Elt 2 (Pair 30 30) } 61) ; Pair 1623062075 0x000056d6705eb537d3450dbd12c20094dc1d38af46b0 ; 1 ; "QmQUbfTUMJ1mBcsEc6ERKEqJSyoVYNpsFDX6EkSLK6TqfW" ; 1234567
    let gachaStorageRegExp: RegExp;
    if (address === '') {
        gachaStorageRegExp = pattern.gachaStorageRegExp;
    } else {
        // need to fix
        const addrHash = `0x${conseiljs.TezosMessageUtils.writeAddress(address)}`;
        gachasQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            gachasQuery,
            'value',
            conseiljs.ConseilOperator.LIKE,
            [`${addrHash} ;`]
        );
        gachaStorageRegExp = new RegExp(
            `Pair [(]Pair ([0-9]+) ([0-9]+)[)] [(]Pair [{] ([()a-zA-Z0-9 ;]+) [}] ([0-9]+)[)] ; Pair ([0-9]+) (${addrHash}) ; ([0-9]+) ; ["](.*)["] ; ([0-9]+)`
        );
    }

    const gachasResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        gachasQuery
    )

    let gachas: Gacha[] = []
    try {
        await Promise.all(gachasResult.map(async (row: any) => {
            const match = gachaStorageRegExp.exec(row['value']);

            if (match?.some) {
                let gachaTotal = 0;
                const gachaId = parseInt(row['key']);
                const items = match[3].split(' ; ');
                const lastPrizeId = parseInt(match[7]);
                const issuer = address != '' ? address : conseiljs.TezosMessageUtils.readAddress(match[6]);

                const [gachaItems, lastPrizeObjIpfsHash] = await Promise.all([
                    Promise.all(items.map(async (item) => {
                        const data = item.split(' ');
                        const total = parseInt(data[4].substr(0, data[4].length - 1));
                        const id = parseInt(data[1]);
                        gachaTotal += total;
                        return {
                            tokenId: id,
                            remain: parseInt(data[3]),
                            total: total,
                            ipfsHash: await akaObjService.getAkaObjIpfsHash(id),
                        }
                    })),
                    akaObjService.getAkaObjIpfsHash(lastPrizeId)
                ]);
                gachas.push({
                    gachaId: gachaId,
                    cancelTime: parseInt(match[1]),
                    gachaAmount: parseInt(match[2]),
                    gachaTotal: gachaTotal,
                    gachaPlayRemains: parseInt(match[4]),
                    issueTime: parseInt(match[5]),
                    issuer: issuer,
                    alias: (await accountService.getAccountAliases([issuer]))[0],
                    gachaItems: gachaItems,
                    lastPrizeTokenId: lastPrizeId,
                    lastPrize: {
                        tokenId: lastPrizeId,
                        ipfsHash: lastPrizeObjIpfsHash,
                    },
                    metadata: await pack.getPackMetadata({ gachaId, ipfsHash: match[8], issuer }, 'GachaBundle'),
                    xtzPerGacha: parseInt(match[9]),
                });
            }
        }));
    } catch (error) {
        console.log(`failed to get gacha list for ${address} with ${error}`);
    }

    gachas.sort((a, b) => b.gachaId - a.gachaId);

    return gachas;
}

async function getCollectOperations(gachaId: number) {
    const gachaAddress = getAkaGachaAddress({gachaId: gachaId});
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(
        query,
        'timestamp',
        'parameters',
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [gachaAddress]
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'parameters_entrypoints',
        conseiljs.ConseilOperator.EQ,
        ['play_gacha']
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'parameters',
        conseiljs.ConseilOperator.ENDSWITH,
        [` ${gachaId}`]
    );
    query = conseiljs.ConseilQueryBuilder.addOrdering(
        query,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    );
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 100000);

    const results: {
        timestamp: number,
        parameters: string,
    }[] = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'operations',
        query
    )

    return results.map((result) => {
        result.timestamp = result.timestamp / 1000;
        return result;
    });
}

async function getGachaPlayInfo(keys: number[], address = '') {
    const gachaPlayMap = getNftGachaPlayMap({playId: keys[keys.length - 1]});
    let infoQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    infoQuery = conseiljs.ConseilQueryBuilder.addFields(
        infoQuery,
        'key',
        'value',
    );
    infoQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        infoQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [gachaPlayMap]
    );
    infoQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        infoQuery,
        'key',
        keys.length > 1
            ? conseiljs.ConseilOperator.IN
            : conseiljs.ConseilOperator.EQ,
        keys
    );
    if (address !== '') {
        infoQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            infoQuery,
            'value',
            conseiljs.ConseilOperator.ENDSWITH,
            [` 0x${conseiljs.TezosMessageUtils.writeAddress(address)})`]
        );
    }
    infoQuery = conseiljs.ConseilQueryBuilder.setLimit(infoQuery, 100);
    const result = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        infoQuery
    );

    const info: {
        key: number,
        gachaAmount: number,
        gachaId: number,
    }[] = [];
    result.forEach(row => {
        const match = pattern.gachaPlayInfoStorageRegExp.exec(row.value);
        if (match?.some) {
            info.push({
                key: parseInt(row.key),
                gachaAmount: parseInt(match[1]),
                gachaId: parseInt(match[2]),
            })
        }
    });

    return info;
}

async function getGachaRecords(gachaId: number) {
    const gacha = await getGacha(gachaId);
    if (gacha === null) {
        return [];
    }
    const transactions: any[] = [];
    const gachaItemIds = gacha.gachaItems.map(item => item.tokenId);
    gachaItemIds.push(gacha.lastPrizeTokenId);
    
    const oracleGachas = await getOracleGachaTransactionsFrom(gacha.issueTime);
    await Promise.all(oracleGachas.map(async (tx: any) => {
        let flag = false;
        const transactionGroup = await tzkt.getTransactionGroup(tx.hash);
        transactionGroup[0].diffs.forEach((diff: any) => {
            if (diff.content.key === `${gachaId}`) {
                flag = true;
            }
        });
        if (flag) {
            transactionGroup.forEach((transaction: any) => {
                if (transaction.parameter?.entrypoint === 'transfer' && transaction.target.address === config.akaNftContract) {
                    transactions.push(transaction);
                }
            })
        }
    }));

    const records: {
        timestamp: number,
        tokenId: number,
        tokenName: string | undefined,
        collector: string,
        alias: string,
        amount: number,
    }[] = [];
    await Promise.all(transactions.map(async (transaction: any) => {
        await Promise.all(transaction.parameter.value[0].txs.map(async (tx: any) => {
            const tokenId = parseInt(tx.token_id);
            if (gachaItemIds.includes(tokenId)) {
                const akaObj = await akaObjService.getAkaObj(tokenId, false, true);
                const collector = tx.to_;
                records.push({
                    timestamp: new Date(transaction.timestamp).getTime() / 1000,
                    tokenId: tokenId,
                    tokenName: akaObj?.tokenInfo.name,
                    collector: collector,
                    alias: (await accountService.getAccountAliases([collector]))[0],
                    amount: parseInt(tx.amount),
                });
            }
        }));
    }));

    records.sort((a, b) => b.timestamp - a.timestamp);

    return records;
}

async function getOracleGachaTransactionsFrom(timestamp: number) {
    const gachaAddress = getAkaGachaAddress({timestamp: timestamp});
    const date = new Date(timestamp * 1000).toISOString();
    const url =
        `${config.tzktServer}/v1/operations/transactions` +
        `?target=${gachaAddress}&entrypoint=oracle_gacha&status=applied&timestamp.ge=${date}&limit=100`;

    const data = (await axios.get(url)).data;

    return data;
}

async function fillGachaInfo(gacha: Gacha) {
    const [restrictedAkaObjs, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    let banned = false;
    const [, lastPrizeTokenInfo] = await Promise.all([
        Promise.all(gacha.gachaItems.map(async (item) => {
            item.tokenInfo = await akaObjService.getAkaObjTokenInfo(item);
            if (restrictedAkaObjs.includes(item.tokenId) ||
                restrictedAddresses.includes(item.tokenInfo.creators[0])) {
                banned = true;
            }
        })),
        akaObjService.getAkaObjTokenInfo(gacha.lastPrize),
    ]);
    gacha.lastPrize.tokenInfo = lastPrizeTokenInfo;
        
    if (restrictedAkaObjs.includes(gacha.lastPrize.tokenId) ||
        restrictedAddresses.includes(gacha.lastPrize.tokenInfo.creators[0])) {
        banned = true;
    }

    if (banned) {
        gacha.banned = true;
    }
}

export default {
    getMakeGachaParametersRegExp,
    getAkaGachaAddress,
    getNftGachaMap,
    getNftGachaPlayMap,
    getGacha,
    getGachas,
    getCollectOperations,
    getGachaPlayInfo,
    getGachaRecords,
    getOracleGachaTransactionsFrom,
    fillGachaInfo
}