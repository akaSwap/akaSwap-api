import axios from 'axios';
import * as conseiljs from 'conseiljs';
import * as _ from 'lodash';

import config from '../config/config';
import * as mongodb from '../utils/mongodb';
import utils from '../utils/utils';
import conseil from './common/conseil';
import pattern from './common/pattern';
import tzkt from './common/tzkt';
import akaObjService from './akaObjService';
import auctionService from './auctionService';
import bundleService from './bundleService';
import gachaService from './gachaService';
import swapService from './swapService';

async function getUserCreations(address: string) {
    let objIdQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    objIdQuery = conseiljs.ConseilQueryBuilder.addFields(
        objIdQuery,
        'key',
    );
    objIdQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        objIdQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftRoyaltiesMap]
    );
    objIdQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        objIdQuery,
        'value',
        conseiljs.ConseilOperator.LIKE,
        [`(Pair 0x${conseiljs.TezosMessageUtils.writeAddress(address)} `]
    );
    objIdQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        objIdQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    );
    objIdQuery = conseiljs.ConseilQueryBuilder.setLimit(
        objIdQuery,
        100000
    );

    const objIdsResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        objIdQuery
    );

    if (objIdsResult.length === 0) {
        return [];
    }

    const objIds = objIdsResult.map((result) => result.key);

    let mintedObjectsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.addFields(
        mintedObjectsQuery,
        'key_hash',
        'value'
    );
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        mintedObjectsQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftMetadataMap]
    );
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        mintedObjectsQuery,
        'key',
        objIds.length > 1
            ? conseiljs.ConseilOperator.IN
            : conseiljs.ConseilOperator.EQ,
        objIds
    );
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.setLimit(
        mintedObjectsQuery,
        objIds.length
    );

    const mintedObjectsResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        mintedObjectsQuery
    )

    const objectInfos: { 
        tokenId: number,
        ipfsHash: string
    }[] = [];
    
    mintedObjectsResult.forEach((row) => {
        const match = pattern.akaObjStorageRegExp.exec(row['value']);
        if (match?.some) {
            const tokenId = utils.toInt(match[1]);
            const ipfsHash = Buffer.from(match[2], 'hex').toString().slice(7);

            objectInfos.push({ 
                tokenId: tokenId,
                ipfsHash: ipfsHash
            })
        }
    })

    return objectInfos.sort((a, b) => b.tokenId - a.tokenId);
}

async function getUserAkaObjs(address: string) {
    let ownAkaObjsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    ownAkaObjsQuery = conseiljs.ConseilQueryBuilder.addFields(
        ownAkaObjsQuery,
        'key',
        'value',
        'operation_group_id'
    );
    ownAkaObjsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        ownAkaObjsQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftLedger]
    );
    ownAkaObjsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        ownAkaObjsQuery,
        'key',
        conseiljs.ConseilOperator.STARTSWITH,
        [`Pair 0x${conseiljs.TezosMessageUtils.writeAddress(address)}`]
    );
    ownAkaObjsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        ownAkaObjsQuery,
        'value',
        conseiljs.ConseilOperator.EQ,
        [0],
        true
    );
    ownAkaObjsQuery = conseiljs.ConseilQueryBuilder.setLimit(
        ownAkaObjsQuery,
        100000
    );

    const ownAkaObjsResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        ownAkaObjsQuery
    );

    if (ownAkaObjsResult.length === 0) {
        return [];
    }

    const ownAkaObjs = ownAkaObjsResult.map((i) => {
        return {
            tokenId: utils.toInt(i['key'].split(' ')[2]),
            amount: utils.toInt(i['value']),
        }
    });
    const objIds = ownAkaObjs.map((obj) => obj.tokenId);

    let mintedObjectsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.addFields(
        mintedObjectsQuery,
        'key_hash',
        'value'
    );
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        mintedObjectsQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftMetadataMap]
    );
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        mintedObjectsQuery,
        'key',
        objIds.length > 1
            ? conseiljs.ConseilOperator.IN
            : conseiljs.ConseilOperator.EQ,
        objIds
    );
    mintedObjectsQuery = conseiljs.ConseilQueryBuilder.setLimit(
        mintedObjectsQuery,
        objIds.length
    );

    const mintedObjectsResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        mintedObjectsQuery
    );

    const objectIpfsMap: { [key: string]: string } = {};
    mintedObjectsResult.forEach((row) => {
        const match = pattern.akaObjStorageRegExp.exec(row['value']);
        if (match?.some) {
            const tokenId = match[1]
            const ipfsHash = Buffer.from(match[2], 'hex').toString().slice(7);

            objectIpfsMap[tokenId] = ipfsHash;
        }
    });

    const results = ownAkaObjs.map((obj) => {
        return {
            ipfsHash: objectIpfsMap[obj.tokenId.toString()],
            ...obj,
        };
    })

    return results.sort((a, b) => b.tokenId - a.tokenId);
}

async function getUserRecords(address: string) {
    let operationsQuery1 = conseiljs.ConseilQueryBuilder.blankQuery();
    operationsQuery1 = conseiljs.ConseilQueryBuilder.addFields(
        operationsQuery1,
        'timestamp',
        'internal',
        'parameters',
        'parameters_entrypoints',
        'operation_group_hash',
    );
    operationsQuery1 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery1,
        'kind',
        conseiljs.ConseilOperator.EQ,
        ['transaction']
    );
    operationsQuery1 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery1,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    operationsQuery1 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery1,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [config.akaNftContract]
    );
    operationsQuery1 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery1,
        'parameters_entrypoints',
        conseiljs.ConseilOperator.IN,
        ['transfer', 'mint']
    );
    operationsQuery1 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery1,
        'parameters',
        conseiljs.ConseilOperator.LIKE,
        [`Pair 0x${conseiljs.TezosMessageUtils.writeAddress(address)}`]
    );
    operationsQuery1 = conseiljs.ConseilQueryBuilder.setLimit(operationsQuery1, 100000);

    let operationsQuery2 = conseiljs.ConseilQueryBuilder.blankQuery();
    operationsQuery2 = conseiljs.ConseilQueryBuilder.addFields(
        operationsQuery2,
        'timestamp',
        'internal',
        'parameters',
        'parameters_entrypoints',
        'operation_group_hash',
    );
    operationsQuery2 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery2,
        'kind',
        conseiljs.ConseilOperator.EQ,
        ['transaction']
    );
    operationsQuery2 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery2,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    operationsQuery2 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery2,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [config.akaNftContract]
    );
    operationsQuery2 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery2,
        'parameters_entrypoints',
        conseiljs.ConseilOperator.EQ,
        ['transfer']
    );
    operationsQuery2 = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery2,
        'parameters',
        conseiljs.ConseilOperator.LIKE,
        [`Pair "${address}"`]
    );
    operationsQuery2 = conseiljs.ConseilQueryBuilder.setLimit(operationsQuery2, 100000);

    const [operationsResult1, operationsResult2] = await Promise.all([
        conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'operations',
            operationsQuery1
        ),
        conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'operations',
            operationsQuery2
        ),
    ])

    const operationsResult: {
        timestamp: number,
        internal: boolean,
        parameters: string,
        parameters_entrypoints: string,
        operation_group_hash: string,
    }[] = [...operationsResult1, ...operationsResult2];

    let records: TransferRecord[] = [];
    const transfers: {
        record: TransferRecord,
        operationGroupHash: string,
    }[] = [];

    await Promise.all(operationsResult.map(async (operation) => {
        if (operation.parameters_entrypoints === 'mint') {
            const match = pattern.mintParametersRegExp.exec(operation.parameters);
            if (match?.some) {
                const tokenId = parseInt(match[3]);
                const akaObj = await akaObjService.getAkaObj(tokenId, false, true);
                records.push({
                    timestamp: operation.timestamp / 1000,
                    tokenId: tokenId,
                    tokenName: akaObj?.tokenInfo.name,
                    type: 'mint',
                    amount: parseInt(match[2]),
                    price: 0,
                });
            }
        } else {
            const match = pattern.transferParametersRegExp.exec(operation.parameters);
            if (match?.some) {
                const sender = match[1].startsWith('"') ?
                    match[1].substr(1, 36) :
                    conseiljs.TezosMessageUtils.readAddress(match[1].substr(2, 44));
                const receiveInfos = match[2].split(' ; ');
                await Promise.all(receiveInfos.map(async (receiveInfo) => {
                    const infoList = receiveInfo.split(' ');
                    const tokenId = parseInt(infoList[3]);
                    const timestamp = operation.timestamp / 1000;
                    const amount = parseInt(infoList[4].substr(0, infoList[4].length - 1));
                    const akaObj = await akaObjService.getAkaObj(tokenId, false, true);
                    const receiver = infoList[1].startsWith('"') ?
                        infoList[1].substr(1, 36) :
                        conseiljs.TezosMessageUtils.readAddress(infoList[1].substr(2, 44));
                    if (operation.internal) {
                        transfers.push({
                            record: {
                                timestamp: timestamp,
                                tokenId: tokenId,
                                tokenName: akaObj?.tokenInfo.name,
                                type: '',
                                amount: amount,
                                price: 0,
                            },
                            operationGroupHash: operation.operation_group_hash,
                        });
                    } else {
                        if (sender === address) {
                            if (receiver === config.burnAddress) {
                                records.push({
                                    timestamp: timestamp,
                                    tokenId: tokenId,
                                    tokenName: akaObj?.tokenInfo.name,
                                    type: 'burn',
                                    amount: amount,
                                    price: 0,
                                });
                            } else {
                                records.push({
                                    timestamp: timestamp,
                                    tokenId: tokenId,
                                    tokenName: akaObj?.tokenInfo.name,
                                    type: 'send',
                                    amount: amount,
                                    price: 0,
                                });
                            }
                        } else {
                            if (receiver === address) {
                                records.push({
                                    timestamp: timestamp,
                                    tokenId: tokenId,
                                    tokenName: akaObj?.tokenInfo.name,
                                    type: 'receive',
                                    amount: amount,
                                    price: 0,
                                });
                            }
                        }
                    }
                }));
            }
        }
    }));

    const entrypointsForRecord = 
        ['collect', 'swap', 'cancel_swap', 'direct_purchase', 'close_auction', 'make_auction', 'cancel_auction',
        'collect_bundle', 'make_bundle', 'cancel_bundle', 'oracle_gacha', 'make_gacha', 'cancel_gacha'];

    let swapData: { id: number, data: TransferRecord }[] = [];
    let auctionData: { id: number, data: TransferRecord }[] = [];
    await Promise.all(transfers.map(async (transfer) => {
        const operation = await conseil.getOperationOfEntrypoints(transfer.operationGroupHash, entrypointsForRecord);
        if (operation === null) {
            return;
        }
        const entryPoint = operation.parameters_entrypoints;
        const record = transfer.record;
        record.type = entryPoint;
        switch (entryPoint) {
            case 'collect':
                record.price = operation.amount;
                break;
            case 'swap':
                {
                    const parameters = pattern.swapParametersRegExp.exec(operation.parameters);
                    if (parameters?.some) {
                        record.price = parseInt(parameters[1]);
                        const blockLevel = operation.block_level;
                        const [sameLevelOperations, storage] = await Promise.all([
                            conseil.getOperationsAtLevel('swap', config.akaMetaverse, blockLevel),
                            tzkt.getContractStorage(config.akaMetaverse, blockLevel - 1)
                        ]);
                        let swapId = parseInt(storage.swap_id);
                        for (let i = 0; i < sameLevelOperations.length; ++i) {
                            if (sameLevelOperations[i].operation_group_hash === transfer.operationGroupHash) {
                                swapId += i;
                                break;
                            }
                        }
                        swapData.push({
                            id: swapId,
                            data: {
                                timestamp: 0,
                                tokenId: record.tokenId,
                                tokenName: record.tokenName,
                                type: 'sell',
                                amount: 1,
                                price: record.price
                            }
                        })
                    }
                }
                break;
            case 'cancel_swap':
                {
                    const swapId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftSwapMap, swapId.toString());
                    record.price = parseInt(content.value.xtz_per_akaOBJ);
                }
                break;
            case 'direct_purchase':
                record.price = operation.amount;
                record.type = 'collect_auction';
                record.auctionId = parseInt(operation.parameters);
                break;
            case 'close_auction':
                {
                    const auctionId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftAuctionMap, auctionId.toString());
                    record.price = parseInt(content.value.current_store_price);
                    record.type = 'collect_auction';
                    record.auctionId = auctionId;
                }
                break;
            case 'make_auction':
                {
                    const parameters = pattern.makeAuctionParametersRegExp.exec(operation.parameters);
                    if (parameters?.some) {
                        record.price = parseInt(parameters[1]);
                        const blockLevel = operation.block_level;
                        const [sameLevelOperations, storage] = await Promise.all([
                            conseil.getOperationsAtLevel('make_auction', config.akaAuction, blockLevel),
                            tzkt.getContractStorage(config.akaAuction, blockLevel - 1)
                        ]);
                        let auctionId = parseInt(storage.auction_id);
                        for (let i = 0; i < sameLevelOperations.length; ++i) {
                            if (sameLevelOperations[i].operation_group_hash === transfer.operationGroupHash) {
                                auctionId += i;
                                break;
                            }
                        }
                        record.auctionId = auctionId;
                        record.auctionTitle = (await auctionService.getAuction(record.auctionId))?.metadata.title;
                        auctionData.push({
                            id: record.auctionId,
                            data: {
                                timestamp: record.timestamp,
                                tokenId: record.tokenId,
                                tokenName: record.tokenName,
                                type: 'sell_auction',
                                amount: 1,
                                price: record.price,
                                auctionId: record.auctionId,
                                auctionTitle: record.auctionTitle,
                            }
                        })
                    }
                }
                break;
            case 'cancel_auction':
                {
                    const auctionId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftAuctionMap, auctionId.toString());
                    record.price = parseInt(content.value.start_price);
                    record.auctionId = auctionId;
                }
                break;
            case 'collect_bundle':
                record.price = operation.amount;
                record.bundleId = parseInt(operation.parameters.split(' ')[2]);
                record.bundleTitle = (await bundleService.getBundle(record.bundleId))?.metadata.title;
                break;
            case 'make_bundle':
                {
                    const parameters = pattern.makeBundleParametersRegExp.exec(operation.parameters);
                    if (parameters?.some) {
                        record.price = parseInt(parameters[1]);
                        const blockLevel = operation.block_level;
                        const [sameLevelOperations, storage] = await Promise.all([
                            conseil.getOperationsAtLevel('make_bundle', config.akaBundle, blockLevel),
                            tzkt.getContractStorage(config.akaBundle, blockLevel - 1)
                        ]);
                        let bundleId = parseInt(storage.bundle_id);
                        for (let i = 0; i < sameLevelOperations.length; ++i) {
                            if (sameLevelOperations[i].operation_group_hash === transfer.operationGroupHash) {
                                bundleId += i;
                                break;
                            }
                        }
                        record.bundleId = bundleId;
                        record.bundleTitle = (await bundleService.getBundle(record.bundleId))?.metadata.title;
                    }
                }
                break;
            case 'cancel_bundle':
                {
                    const bundleId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftBundleMap, bundleId.toString());
                    record.price = parseInt(content.value.xtz_per_bundle);
                    record.bundleId = bundleId;
                }
                break;
            case 'oracle_gacha':
                // TODO: gacha plays with different ids in one oracle_gacha
                {
                    const blockLevel = operation.block_level;
                    const gachaAddress = gachaService.getAkaGachaAddress({blockLevel: blockLevel});
                    const [previousStorage, storage] = await Promise.all([
                        tzkt.getContractStorage(gachaAddress, blockLevel - 1),
                        tzkt.getContractStorage(gachaAddress, blockLevel)
                    ]);
                    const startId = parseInt(previousStorage.oracle_play_id);
                    const endId = parseInt(storage.oracle_play_id);
                    const gachaPlayInfo = await gachaService.getGachaPlayInfo(_.range(startId, endId), address);
                    const gachaId = gachaPlayInfo[0].gachaId;
                    const gachaMap = gachaService.getNftGachaMap({gachaId: gachaId});
                    const content = await tzkt.getBigMapContent(gachaMap, gachaId.toString());
                    record.price = parseInt(content.value.xtz_per_gacha); 
                    record.type = 'collect_gacha';
                    record.gachaId = gachaId;
                    record.gachaTitle = (await gachaService.getGacha(record.gachaId))?.metadata.title;
                }
                break;
            case 'make_gacha':
                {
                    const blockLevel = operation.block_level;
                    const parameters = gachaService.getMakeGachaParametersRegExp(blockLevel).exec(operation.parameters);
                    if (parameters?.some) {
                        record.price = parseInt(parameters[1]);
                        const gachaAddress = gachaService.getAkaGachaAddress({blockLevel: blockLevel});
                        const [sameLevelOperations, storage] = await Promise.all([
                            conseil.getOperationsAtLevel('make_gacha', gachaAddress, blockLevel),
                            tzkt.getContractStorage(gachaAddress, blockLevel - 1)
                        ]);
                        let gachaId = parseInt(storage.gacha_id);
                        for (let i = 0; i < sameLevelOperations.length; ++i) {
                            if (sameLevelOperations[i].operation_group_hash === transfer.operationGroupHash) {
                                gachaId += i;
                                break;
                            }
                        }
                        record.gachaId = gachaId;
                        record.gachaTitle = (await gachaService.getGacha(record.gachaId))?.metadata.title;
                    }
                }
                break;
            case 'cancel_gacha':
                {
                    const gachaId = parseInt(operation.parameters);
                    const gachaMap = gachaService.getNftGachaMap({gachaId: gachaId});
                    const content = await tzkt.getBigMapContent(gachaMap, gachaId.toString());
                    record.price = parseInt(content.value.xtz_per_gacha); 
                    record.gachaId = gachaId;
                }
                break;
        }
        records.push(record);
    }));

    let makeGachas: { [key: number]: TransferRecord } = {};
    let cancelGachas: { [key: number]: TransferRecord } = {};
    let gachaData: { id: number, data: TransferRecord }[] = [];
    let makeBundles: { [key: number]: TransferRecord } = {};
    let cancelBundles: { [key: number]: TransferRecord } = {};
    let bundleData: { id: number, data: TransferRecord }[] = [];
    let otherRecords: TransferRecord[] = [];
    records.forEach((record) => {
        if (record.type === 'make_gacha' && record.gachaId !== undefined) {
            if (makeGachas.hasOwnProperty(record.gachaId)) {
                makeGachas[record.gachaId].amount += record.amount;
            } else {
                makeGachas[record.gachaId] = {
                    timestamp: record.timestamp,
                    type: record.type,
                    amount: record.amount - 1,  // minus last prize
                    price: record.price,
                    gachaId: record.gachaId,
                    gachaTitle: record.gachaTitle,
                }
                gachaData.push({
                    id: record.gachaId,
                    data: {
                        timestamp: record.timestamp,
                        type: 'sell_gacha',
                        amount: 1,
                        price: record.price,
                        gachaId: record.gachaId,
                        gachaTitle: record.gachaTitle,
                    }
                })
            }
        } else if (record.type === 'cancel_gacha' && record.gachaId !== undefined) {
            if (cancelGachas.hasOwnProperty(record.gachaId)) {
                cancelGachas[record.gachaId].amount += record.amount;
            } else {
                cancelGachas[record.gachaId] = {
                    timestamp: record.timestamp,
                    type: record.type,
                    amount: record.amount - 1,  // minus last prize
                    price: record.price,
                    gachaId: record.gachaId,
                    gachaTitle: record.gachaTitle,
                }
            }
        } else if (record.type === 'make_bundle' && record.bundleId !== undefined) {
            if (!makeBundles.hasOwnProperty(record.bundleId)) {
                makeBundles[record.bundleId] = {
                    timestamp: record.timestamp,
                    type: record.type,
                    amount: record.amount,
                    price: record.price,
                    bundleId: record.bundleId,
                    bundleTitle: record.bundleTitle,
                }
                bundleData.push({
                    id: record.bundleId,
                    data: {
                        timestamp: record.timestamp,
                        type: 'sell_bundle',
                        amount: 1,
                        price: record.price,
                        bundleId: record.bundleId,
                        bundleTitle: record.bundleTitle,
                    }
                })
            }
        } else if (record.type === 'cancel_bundle' && record.bundleId !== undefined) {
            if (!cancelBundles.hasOwnProperty(record.bundleId)) {
                cancelBundles[record.bundleId] = {
                    timestamp: record.timestamp,
                    type: record.type,
                    amount: record.amount,
                    price: record.price,
                    bundleId: record.bundleId,
                    bundleTitle: record.bundleTitle,
                }
            }
        } else {
            otherRecords.push(record);
        }
    })
    records = otherRecords
        .concat(_.values(makeGachas))
        .concat(_.values(cancelGachas))
        .concat(_.values(makeBundles))
        .concat(_.values(cancelBundles));

    // TODO: need to optimize
    await Promise.all([
        Promise.all(swapData.map(async (data) => {
            let r: any[] = [];
            try {
                r = await swapService
                    .getCollectOperations(data.id)
                    .then((results) => {
                        return results.map((result) => {
                            const amount = parseInt(result.parameters.split(' ')[1]);
                            return {
                                timestamp: result.timestamp,
                                tokenId: data.data.tokenId,
                                tokenName: data.data.tokenName,
                                type: data.data.type,
                                amount: amount,
                                price: data.data.price
                            }
                        })
                    });
            } finally {
                records = records.concat(r);
            }
        })),
        Promise.all(auctionData.map(async (data) => {
            let r: any[] = [];
            try {
                r = (await auctionService
                    .getCollectOperations(data.id)
                    .then(async (results) => {
                        const entrypoints = ['close_auction', 'direct_purchase'];
                        return await Promise.all(results.map(async (result) => {
                            const operation = await conseil.getOperationOfEntrypoints(result.operation_group_hash, entrypoints);
                            if (operation === null) {
                                return null;
                            }
                            let price = data.data.price;
                            if (operation.parameters_entrypoints === 'close_auction') {
                                const content = await tzkt.getBigMapContent(config.nftAuctionMap, data.id.toString());
                                price = parseInt(content.value.current_store_price);
                            } else if (operation.parameters_entrypoints === 'direct_purchase') {
                                price = operation.amount;
                            }
                            return {
                                timestamp: result.timestamp,
                                tokenId: data.data.tokenId,
                                tokenName: data.data.tokenName,
                                type: data.data.type,
                                amount: 1,
                                price: price,
                                auctionId: data.data.auctionId,
                                auctionTitle: data.data.auctionTitle,
                            }
                        }))
                    })).filter((result) => result !== null);
            } finally {
                records = records.concat(r);
            }
        })),
        Promise.all(bundleData.map(async (data) => {
            let r: any[] = [];
            try {
                r = await bundleService
                    .getCollectOperations(data.id)
                    .then((results) => {
                        return results.map((result) => {
                            const amount = parseInt(result.parameters.split(' ')[1]);
                            return {
                                timestamp: result.timestamp,
                                type: data.data.type,
                                amount: amount,
                                price: data.data.price,
                                bundleId: data.data.bundleId,
                                bundleTitle: data.data.bundleTitle,
                            }
                        })
                    });
            } finally {
                records = records.concat(r);
            }
        })),
        Promise.all(gachaData.map(async (data) => {
            let r: any[] = [];
            try {
                r = await gachaService
                    .getCollectOperations(data.id)
                    .then((results) => {
                        return results.map((result) => {
                            const amount = parseInt(result.parameters.split(' ')[1]);
                            return {
                                timestamp: result.timestamp,
                                type: data.data.type,
                                amount: amount,
                                price: data.data.price,
                                gachaId: data.data.gachaId,
                                gachaTitle: data.data.gachaTitle,
                            }
                        })
                    });
            } finally {
                records = records.concat(r);
            }
        })),
    ]);

    records.sort((a, b) => b.timestamp - a.timestamp);

    return records;
}

async function getAkaDaoBalance(address: string) {
    let addr = '';
    try {
        addr = conseiljs.TezosMessageUtils.writeAddress(address);
    } catch {
        return 0;
    }

    let akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.addFields(
        akaDaoBalanceQuery,
        'value'
    );
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaDaoBalanceQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.akaDaoLedger]
    );
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaDaoBalanceQuery,
        'key',
        conseiljs.ConseilOperator.EQ,
        [`Pair 0x${addr} 0`]
    );
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaDaoBalanceQuery,
        'value',
        conseiljs.ConseilOperator.EQ,
        [0],
        true
    );
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.setLimit(akaDaoBalanceQuery, 1);

    let balance = 0;
    try {
        const balanceResult = await conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'big_map_contents',
            akaDaoBalanceQuery
        );
        balance = parseInt(balanceResult[0]['value']);
    } catch (error) {
        console.log(
            `getAkaDaoBalanceForAddress failed for ${JSON.stringify(
                akaDaoBalanceQuery
            )} with ${error}`
        );
    }

    return balance;
}

async function getAkaDaoBalances() {
    let akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.addFields(
        akaDaoBalanceQuery,
        'key',
        'value'
    );
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaDaoBalanceQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.akaDaoLedger]
    );
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaDaoBalanceQuery,
        'value',
        conseiljs.ConseilOperator.EQ,
        [0],
        true
    );
    akaDaoBalanceQuery = conseiljs.ConseilQueryBuilder.setLimit(akaDaoBalanceQuery, 100000);

    const akaDaoBalanceResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        akaDaoBalanceQuery
    );

    let result: {
        address: string,
        akaDao: number,
    }[] = [];
    akaDaoBalanceResult.forEach((row) => {
        const match = pattern.akaDaoLedgerStorageRegExp.exec(row['key']);
        if (match?.some) {
            const address = conseiljs.TezosMessageUtils.readAddress(match[1]);
            result.push({
                address: address,
                akaDao: parseInt(row['value'])
            });
        }
    });
    return result;
}

async function getAccountAliases(addresses: string[]) {
    const client = await mongodb.connectToDatabase();
    const dbCollection = client.db('akaSwap-DB').collection('account-metadata');
    const aliases: string[] = await Promise.all(addresses.map(async (address) => {
        const metadata = await dbCollection.findOne({ address: address });
        return metadata?.alias !== undefined ? metadata.alias : '';
    }));
    return aliases;
}

async function updateAccountMetadata(address: string) {
    const client = await mongodb.connectToDatabase();
    const dbCollection = client.db('akaSwap-DB').collection('account-metadata');
    const filter = { address: address };
    const metadata = await dbCollection.findOne(filter);
    if (metadata === null || (Date.now() - metadata.timestamp) > utils.ONE_WEEK_MILLIS) {
        const data = (await axios.get<any>(`https://api.tzkt.io/v1/accounts/${address}/metadata`)).data;
        if (data !== '' && data.error === undefined) {
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    address: address,
                    timestamp: Date.now(),
                    ...data,
                },
            };
            const result = await dbCollection.updateOne(filter, updateDoc, options);
            if (result.upsertedId !== undefined) {
                console.log(`Insert metadata of account ${address}`);
            } else if (result.modifiedCount > 0) {
                console.log(`Update metadata of account ${address}`);
            }
        }
    }
}

export default {
    getUserCreations,
    getUserAkaObjs,
    getAccountAliases,
    getUserRecords,
    getAkaDaoBalance,
    getAkaDaoBalances,
    updateAccountMetadata,
}