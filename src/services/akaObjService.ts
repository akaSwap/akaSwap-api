import * as conseiljs from 'conseiljs';
import * as _ from 'lodash';

import config from '../config/config';
import * as mongodb from '../utils/mongodb';
import utils from '../utils/utils';
import conseil from './common/conseil';
import ipfs from './common/ipfs';
import pack from './common/pack';
import pattern from './common/pattern';
import tzkt from './common/tzkt';
import accountService from './accountService';
import auctionService from './auctionService';
import bundleService from './bundleService';
import gachaService from './gachaService';

async function getAkaObjOwners(tokenId: number) {
    let akaObjBalanceQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    akaObjBalanceQuery = conseiljs.ConseilQueryBuilder.addFields(
        akaObjBalanceQuery,
        'key',
        'value'
    );
    akaObjBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaObjBalanceQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftLedger]
    );
    akaObjBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaObjBalanceQuery,
        'key',
        conseiljs.ConseilOperator.ENDSWITH,
        [` ${tokenId}`],
    );
    akaObjBalanceQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        akaObjBalanceQuery,
        'value',
        conseiljs.ConseilOperator.EQ,
        [0],
        true
    );
    akaObjBalanceQuery = conseiljs.ConseilQueryBuilder.setLimit(
        akaObjBalanceQuery,
        100000
    );

    const owners: { [key: string]: number } = {};
    const aliases: { [key: string]: string } = {};

    try {
        const balanceResult = await conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'big_map_contents',
            akaObjBalanceQuery
        );

        await Promise.all(balanceResult.map(async (row) => {
            const address = conseiljs.TezosMessageUtils.readAddress(
                row['key'].split(' ')[1].substr(2, 44)
            );
            owners[address] = utils.toInt(row['value']);
            aliases[address] = (await accountService.getAccountAliases([address]))[0];
        }));
    } catch (error) {
        console.log(
            `getAkaObjwners failed for ${JSON.stringify(
                akaObjBalanceQuery
            )} with ${error}`
        );
    }

    const ownedCounts = _.values(owners);
    let total = 0;

    if (ownedCounts.length) {
        total = ownedCounts.reduce((acc, i) => {
            const owned = i;
            return owned > 0 ? acc + owned : acc;
        }, 0);
    }

    return {
        owners,
        aliases,
        totalAmount: total,
    };
}

async function getAllAkaObjIds() {
    let objectQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    objectQuery = conseiljs.ConseilQueryBuilder.addFields(
        objectQuery,
        'key',
        'value',
    );
    objectQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        objectQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftRoyaltiesMap]
    );
    objectQuery = conseiljs.ConseilQueryBuilder.setLimit(objectQuery, 100000);
    const objectResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        objectQuery
    )

    const results: {
        tokenId: number,
        minter: string,
    }[] = [];

    objectResult.forEach((row) => {
        const match = pattern.royaltyStorageRegExp.exec(row['value']);
        if (match?.some) {
            results.push({
                tokenId: parseInt(row.key),
                minter: conseiljs.TezosMessageUtils.readAddress(match[2]),
            })
        }
    });

    results.sort((a, b) => b.tokenId - a.tokenId);

    return results;
}

async function getAkaObjSwapsInfo(tokenId: number) {
    let swapsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    swapsQuery = conseiljs.ConseilQueryBuilder.addFields(
        swapsQuery,
        'key',
        'value'
    );
    swapsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        swapsQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftSwapMap]
    );
    // need optimize
    // Pair 1 6 ; 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 ; { Elt 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 1000 } ; 1000000
    swapsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        swapsQuery,
        'value',
        conseiljs.ConseilOperator.LIKE,
        [` ${tokenId} `]
    );
    swapsQuery = conseiljs.ConseilQueryBuilder.setLimit(swapsQuery, 100000); // NOTE, limited to 100000 swaps for a given object

    const swapsResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        swapsQuery
    );

    const swaps: {
        swapId: number,
        issuer: string,
        alias: string,
        akaObjAmount: number,
        xtzPerAkaObj: number,
    }[] = [];
    // Pair 1 6 ; 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 ; { Elt 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 1000 } ; 1000000
    const swapStorageRegExp = new RegExp(
        `Pair ([0-9]+) (${tokenId}) ; 0x([0-9a-z]{44}) ; [{] ([a-zA-Z0-9 ;]+) [}] ; ([0-9]+)`
    );
    await Promise.all(swapsResult.map(async (row: any) => {
        const match = swapStorageRegExp.exec(row['value']);
        if (match?.some) {
            const issuer = conseiljs.TezosMessageUtils.readAddress(match[3]);
            swaps.push({
                swapId: parseInt(row['key']),
                issuer: issuer,
                alias: (await accountService.getAccountAliases([issuer]))[0],
                akaObjAmount: parseInt(match[1]),
                xtzPerAkaObj: parseInt(match[5]),
            });
        }
    }));
    
    return swaps.sort((a, b) => b.swapId - a.swapId);
}

async function getAkaObjAuctionsInfo(tokenId: number) {
    let auctionsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    auctionsQuery = conseiljs.ConseilQueryBuilder.addFields(
        auctionsQuery,
        'key',
        'value'
    );
    auctionsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        auctionsQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftAuctionMap]
    );
    auctionsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        auctionsQuery,
        'value',
        conseiljs.ConseilOperator.LIKE,
        [`{ Pair ${tokenId} `]
    );
    auctionsQuery = conseiljs.ConseilQueryBuilder.setLimit(auctionsQuery, 100000);

    const auctionsResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        auctionsQuery
    );
    
    const auctions: {
        auctionId: number,
        issuer: string,
        alias: string,
        akaObjAmount: number,
        currentBidPrice: number,
        dueTime: number,
        auctionTitle: string,
    }[] = [];
    await Promise.all(auctionsResult.map(async (row: any) => {
        const match = pattern.auctionStorageRegExp.exec(row['value']);
        if (match?.some) {
            const auctionId = parseInt(row['key']);
            const issuer = conseiljs.TezosMessageUtils.readAddress(match[7]);
            const ipfsHash = match[8];
            const auctionTitle = await pack.getPackTitle({ auctionId, ipfsHash, issuer });
            auctions.push({
                auctionId: auctionId,
                issuer: issuer,
                alias: (await accountService.getAccountAliases([issuer]))[0],
                akaObjAmount: 1,
                currentBidPrice: parseInt(match[2]),
                dueTime: parseInt(match[6]),
                auctionTitle: auctionTitle,
            });
        }
    }))

    return auctions.sort((a, b) => b.auctionId - a.auctionId);
}

async function getAkaObjBundlesInfo(tokenId: number) {
    let bundlesQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    bundlesQuery = conseiljs.ConseilQueryBuilder.addFields(
        bundlesQuery,
        'key',
        'value'
    );
    bundlesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bundlesQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftBundleMap]
    );
    bundlesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bundlesQuery,
        'value',
        conseiljs.ConseilOperator.LIKE,
        [` Elt ${tokenId} `]
    );
    bundlesQuery = conseiljs.ConseilQueryBuilder.setLimit(bundlesQuery, 100000);

    const bundlesResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        bundlesQuery
    );
    
    const bundles: {
        bundleId: number,
        issuer: string,
        alias: string,
        bundleAmount: number,
        akaObjAmount: number,
        xtzPerBundle: number,
        bundleTitle: string,
    }[] = [];
    await Promise.all(bundlesResult.map(async (row: any) => {
        const match = pattern.bundleStorageRegExp.exec(row['value']);
        if (match?.some) {
            const items = match[2].split(' ; ');
            await Promise.all(items.map(async (item) => {
                const info = item.split(' ');
                if (info[1] === tokenId.toString()) {
                    const bundleId = parseInt(row['key']);
                    const issuer = conseiljs.TezosMessageUtils.readAddress(match[3]);
                    const ipfsHash = match[4];
                    const bundleTitle = await pack.getPackTitle({ bundleId, ipfsHash, issuer });
                    bundles.push({
                        bundleId: bundleId,
                        issuer: issuer,
                        alias: (await accountService.getAccountAliases([issuer]))[0],
                        bundleAmount: parseInt(match[1]),
                        akaObjAmount: parseInt(info[2]),
                        xtzPerBundle: parseInt(match[5]),
                        bundleTitle: bundleTitle,
                    })
                }
            }));
        }
    }));

    return bundles.sort((a, b) => b.bundleId - a.bundleId);
}

async function getAkaObjGachasInfo(tokenId: number) {
    const queries: any[] = [];
    let gachaPrizesQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    gachaPrizesQuery = conseiljs.ConseilQueryBuilder.addFields(
        gachaPrizesQuery,
        'key',
        'value'
    );
    gachaPrizesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        gachaPrizesQuery,
        'big_map_id',
        config.nftGachaMap.length > 1
            ? conseiljs.ConseilOperator.IN
            : conseiljs.ConseilOperator.EQ,
        config.nftGachaMap
    );
    gachaPrizesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        gachaPrizesQuery,
        'value',
        conseiljs.ConseilOperator.LIKE,
        [` Elt ${tokenId} `]
    );
    gachaPrizesQuery = conseiljs.ConseilQueryBuilder.setLimit(gachaPrizesQuery, 100000);

    queries.push(
        conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'big_map_contents',
            gachaPrizesQuery
        )
    );

    let gachaLastPrizesQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    gachaLastPrizesQuery = conseiljs.ConseilQueryBuilder.addFields(
        gachaLastPrizesQuery,
        'key',
        'value'
    );
    gachaLastPrizesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        gachaLastPrizesQuery,
        'big_map_id',
        config.nftGachaMap.length > 1
            ? conseiljs.ConseilOperator.IN
            : conseiljs.ConseilOperator.EQ,
        config.nftGachaMap
    );
    // need optimize
    gachaLastPrizesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        gachaLastPrizesQuery,
        'value',
        conseiljs.ConseilOperator.LIKE,
        [` ${tokenId} `]
    );
    gachaLastPrizesQuery = conseiljs.ConseilQueryBuilder.setLimit(gachaLastPrizesQuery, 100000);

    queries.push(
        conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'big_map_contents',
            gachaLastPrizesQuery
        )
    );

    const [gachaPrizesResult, gachaLastPrizesResult] = await Promise.all(queries);

    const gachas: {
        gachaId: number,
        issuer: string,
        alias: string,
        akaObjRemain: number,
        xtzPerGacha: number,
        issueTime: number,
        cancelTime: number,
        gachaTitle: string,
    }[] = [];
    const gachaMap = new Map<number, {
        issuer: string,
        akaObjRemain: number,
        xtzPerGacha: number,
        issueTime: number,
        cancelTime: number,
        ipfsHash: string,
    }>();
    gachaPrizesResult.forEach((row: any) => {
        const match = pattern.gachaStorageRegExp.exec(row['value']);
        if (match?.some) {
            const items = match[3].split(' ; ');
            items.forEach(item => {
                const info = item.split(' ');
                if (info[1] === tokenId.toString()) {
                    gachaMap.set(
                        parseInt(row['key']),
                        {
                            issuer: conseiljs.TezosMessageUtils.readAddress(match[6]),
                            akaObjRemain: parseInt(info[3]),
                            xtzPerGacha: parseInt(match[9]),
                            issueTime: parseInt(match[5]),
                            cancelTime: parseInt(match[1]),
                            ipfsHash: match[8]
                        }
                    );
                }
            });
        }
    });

    // Pair (Pair 1623148475 61) (Pair { Elt 0 (Pair 30 30) ; Elt 1 (Pair 1 1) ; Elt 2 (Pair 30 30) } 61) ; Pair 1623062075 0x000056d6705eb537d3450dbd12c20094dc1d38af46b0 ; 1 ; "QmQUbfTUMJ1mBcsEc6ERKEqJSyoVYNpsFDX6EkSLK6TqfW" ; 1234567
    const gachaStorageWithAkaObjIdRegExp = new RegExp(
        `Pair [(]Pair ([0-9]+) ([0-9]+)[)] [(]Pair [{] ([()a-zA-Z0-9 ;]+) [}] ([0-9]+)[)] ; Pair ([0-9]+) 0x([0-9a-z]{44}) ; (${tokenId}) ; ["](.*)["] ; ([0-9]+)`
    );
    gachaLastPrizesResult.forEach((row: any) => {
        const match = gachaStorageWithAkaObjIdRegExp.exec(row['value']);
        if (match?.some) {
            const id = parseInt(row['key']);
            const lastPrizeCount = parseInt(match[2]) > 0 ? 1 : 0;
            if (gachaMap.has(id)) {
                (<any>gachaMap.get(id)).akaObjRemain += lastPrizeCount;
            } else {
                gachaMap.set(
                    id,
                    {
                        issuer: conseiljs.TezosMessageUtils.readAddress(match[6]),
                        akaObjRemain: lastPrizeCount,
                        xtzPerGacha: parseInt(match[9]),
                        issueTime: parseInt(match[5]),
                        cancelTime: parseInt(match[1]),
                        ipfsHash: match[8]
                    }
                );
            }
        }
    });
    
    const promises: Promise<void>[] = [];
    gachaMap.forEach((value, key) => {
        if (value.akaObjRemain > 0) {
            const func = async () => {
                const gachaId = key;
                const issuer = value.issuer;
                const ipfsHash = value.ipfsHash;
                const gachaTitle = await pack.getPackTitle({ gachaId, ipfsHash, issuer });
                gachas.push({
                    gachaId: gachaId,
                    issuer: issuer,
                    alias: (await accountService.getAccountAliases([issuer]))[0],
                    akaObjRemain: value.akaObjRemain,
                    xtzPerGacha: value.xtzPerGacha,
                    issueTime: value.issueTime,
                    cancelTime: value.cancelTime,
                    gachaTitle: gachaTitle,
                })
            };
            promises.push(func());
        }
    });
    await Promise.all(promises);

    return gachas.sort((a, b) => b.gachaId - a.gachaId);
}

async function getAkaObjSalesInfo(tokenId: number) {
    const [swaps, auctions, bundles, gachas] = await Promise.all([
        getAkaObjSwapsInfo(tokenId),
        getAkaObjAuctionsInfo(tokenId),
        getAkaObjBundlesInfo(tokenId),
        getAkaObjGachasInfo(tokenId),
    ]);

    return { swaps, auctions, bundles, gachas };
}

async function getAkaObjIpfsHash(tokenId: number) {
    let objectQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    objectQuery = conseiljs.ConseilQueryBuilder.addFields(objectQuery,
        'key',
        'value'
    );
    objectQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        objectQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftMetadataMap]
    );
    objectQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        objectQuery,
        'key',
        conseiljs.ConseilOperator.EQ,
        [tokenId]
    );
    objectQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        objectQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    )
    objectQuery = conseiljs.ConseilQueryBuilder.setLimit(objectQuery, 1);

    const objectResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        objectQuery
    )

    if (objectResult.length === 0) {
        return "";
    }

    const objectUrl = objectResult[0]['value']
        .toString()
        .replace(/.* 0x([0-9a-z]{1,}) \}$/, '$1');
    const ipfsHash = Buffer.from(objectUrl, 'hex').toString().slice(7);

    return ipfsHash;
}

async function getAkaObjCreatorShares(tokenId: number) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(
        query,
        'value',
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftRoyaltiesMap]
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'key',
        conseiljs.ConseilOperator.EQ,
        [tokenId]
    );
    query = conseiljs.ConseilQueryBuilder.setLimit(query, 1);
    const result = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        query
    );

    const match = pattern.royaltyStorageRegExp.exec(result[0]['value']);
    if (match?.some) {
        const minter = conseiljs.TezosMessageUtils.readAddress(match[2]);
        let creators = [minter];
        let shares = [0];
        match[1].split(' ; ').forEach((pair) => {
            const data = pair.split(' ');
            const creator = conseiljs.TezosMessageUtils.readAddress(data[1].substr(2, 44));
            const share = parseInt(data[2]);
            if (creator === minter) {
                shares[0] = share;
            } else {
                creators.push(creator);
                shares.push(share);
            }
        });
        return { creators, shares };
    } else {
        return { creators: [], shares: [] };
    }
}

async function getAkaObjTokenInfo(akaObj: any, useIpfs = false): Promise<TokenInfo> {
    const id = akaObj.tokenId;
    if (useIpfs) {
        const tokenInfo = await ipfs.getIpfsData(akaObj.ipfsHash);
        if (tokenInfo === undefined) {
            const creatorShares = await getAkaObjCreatorShares(id);
            const aliases = await accountService.getAccountAliases(creatorShares.creators);
            return {
                name: '',
                description: '',
                tags: [],
                frameColor: '',
                symbol: 'akaOBJ',
                artifactUri: '',
                displayUri: '',
                thumbnailUri: '',
                aliases: aliases,
                creators: creatorShares.creators,
                creatorShares: creatorShares.shares,
                formats: [
                    {
                        uri: '',
                        mimeType: ''
                    }
                ],
                decimals: 0,
                isBooleanAmount: false,
                shouldPreferSymbol: false
            }
        } else {
            const creatorShares = await getAkaObjCreatorShares(id);
            const aliases = await accountService.getAccountAliases(creatorShares.creators);
            tokenInfo.aliases = aliases;
            tokenInfo.creators = creatorShares.creators;
            tokenInfo.creatorShares = creatorShares.shares;
            return tokenInfo;
        }
    } else {
        const client = await mongodb.connectToDatabase();
        const database = client.db('akaSwap-DB');
        const metadata = database.collection('akaObj-metadata');
        const res = await metadata.findOne({ tokenId : id });
        if (res !== null && res.name !== '' && res.creators.length > 0) {
            delete res._id;
            delete res.tokenId;
            delete res.ipfsHash;
            const aliases = await accountService.getAccountAliases(res.creators);
            res.aliases = aliases;
            return res;
        } else {
            console.log(`get akaObj ${id} from ipfs`);
            const metadata = await getAkaObjTokenInfo(akaObj, true);
            if (metadata.artifactUri !== '' || metadata.creators.length > 0) {
                if (config.pinIpfs) {
                    ipfs.pinIpfsData(akaObj.ipfsHash);
                    ipfs.pinIpfsData(metadata.artifactUri.split('//')[1]);
                    ipfs.pinIpfsData(metadata.displayUri.split('//')[1]);
                    ipfs.pinIpfsData(metadata.thumbnailUri.split('//')[1]);
                }
                await updateAkaObjTokenInfo(id, metadata);
            }
            return metadata;
        }
    }
}

async function getAkaObj(tokenId: number, withSales = true, withBurned = false) {
    try {
        const ipfsHash = await getAkaObjIpfsHash(tokenId).catch(() => "");
        if (ipfsHash === "") {
            return null;
        }

        const [akaObjOwners, tokenInfo, sales] = await Promise.all([
            getAkaObjOwners(tokenId),
            getAkaObjTokenInfo({ tokenId, ipfsHash }),
            withSales ? getAkaObjSalesInfo(tokenId) : undefined
        ]);

        if (!withBurned) {
            const burnAddrCount = akaObjOwners.owners[config.burnAddress];
            const allIssuesBurned = burnAddrCount && burnAddrCount === akaObjOwners.totalAmount;
            akaObjOwners.totalAmount -= typeof burnAddrCount === 'number' ? burnAddrCount : 0;
            delete akaObjOwners.owners[config.burnAddress];
            if (allIssuesBurned) {
                return null;
            }
        }

        const akaObj: AkaObj = {
            tokenId: tokenId,
            ipfsHash: ipfsHash,
            sales: sales,
            ...akaObjOwners,
            tokenInfo: tokenInfo,
        }

        return akaObj;
    } catch (e) {
        console.log(tokenId);
        console.log(e);
        return null;
    }
}

async function getAkaObjRecords(tokenId: number) {
    let operationsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    operationsQuery = conseiljs.ConseilQueryBuilder.addFields(
        operationsQuery,
        'timestamp',
        'internal',
        'parameters',
        'parameters_entrypoints',
        'operation_group_hash',
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'kind',
        conseiljs.ConseilOperator.EQ,
        ['transaction']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [config.akaNftContract]
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'parameters_entrypoints',
        conseiljs.ConseilOperator.IN,
        ['transfer', 'mint']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'parameters',
        conseiljs.ConseilOperator.LIKE,
        [`(Pair ${tokenId}`]
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.setLimit(operationsQuery, 100000);

    const operationsResult: {
        timestamp: number,
        internal: boolean,
        parameters: string,
        parameters_entrypoints: string,
        operation_group_hash: string,
    }[] = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'operations',
        operationsQuery
    );

    const records: TransferRecord[] = [];
    const transfers: {
        record: TransferRecord,
        from: string,
        to: string,
        operationGroupHash: string,
    }[] = [];

    await Promise.all(operationsResult.map(async (operation) => {
        if (operation.parameters_entrypoints === 'mint') {
            const match = pattern.mintParametersRegExp.exec(operation.parameters);
            if (match?.some) {
                const address = conseiljs.TezosMessageUtils.readAddress(match[1]);
                records.push({
                    timestamp: operation.timestamp / 1000,
                    tokenId: tokenId,
                    address: address,
                    alias: (await accountService.getAccountAliases([address]))[0],
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
                    if (infoList[3] === tokenId.toString()) {
                        const timestamp = operation.timestamp / 1000;
                        const receiver = infoList[1].startsWith('"') ?
                            infoList[1].substr(1, 36) :
                            conseiljs.TezosMessageUtils.readAddress(infoList[1].substr(2, 44));
                        const amount = parseInt(infoList[4].substr(0, infoList[4].length - 1));
                        if (operation.internal) {
                            transfers.push({
                                record: {
                                    timestamp: timestamp,
                                    tokenId: tokenId,
                                    address: '',
                                    alias: '',
                                    type: '',
                                    amount: amount,
                                    price: 0,
                                },
                                from: sender,
                                to: receiver,
                                operationGroupHash: operation.operation_group_hash,
                            });
                        } else {
                            if (receiver === config.burnAddress) {
                                records.push({
                                    timestamp: timestamp,
                                    tokenId: tokenId,
                                    address: sender,
                                    alias: (await accountService.getAccountAliases([sender]))[0],
                                    type: 'burn',
                                    amount: amount,
                                    price: 0,
                                });
                            } else {
                                records.push({
                                    timestamp: timestamp,
                                    tokenId: tokenId,
                                    address: sender,
                                    alias: (await accountService.getAccountAliases([sender]))[0],
                                    type: 'send',
                                    amount: amount,
                                    price: 0,
                                });
                                records.push({
                                    timestamp: timestamp,
                                    tokenId: tokenId,
                                    address: receiver,
                                    alias: (await accountService.getAccountAliases([receiver]))[0],
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
    await Promise.all(transfers.map(async (transfer) => {
        const operation = await conseil.getOperationOfEntrypoints(transfer.operationGroupHash, entrypointsForRecord);
        if (operation === null) {
            return null;
        }
        const entryPoint = operation.parameters_entrypoints;
        const record = transfer.record;
        record.type = entryPoint;
        switch (entryPoint) {
            case 'collect':
                record.price = operation.amount;
                record.address = transfer.to;
                record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
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
                        record.address = transfer.from;
                        record.alias = (await accountService.getAccountAliases([transfer.from]))[0];
                    }
                }
                break;
            case 'cancel_swap':
                {
                    const swapId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftSwapMap, swapId.toString());
                    record.price = parseInt(content.value.xtz_per_akaOBJ);
                    record.address = transfer.to;
                    record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
                }
                break;
            case 'direct_purchase':
                record.address = transfer.to;
                record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
                record.price = operation.amount;
                record.type = 'collect_auction';
                record.auctionId = parseInt(operation.parameters);
                break;
            case 'close_auction':
                {
                    const auctionId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftAuctionMap, auctionId.toString());
                    record.address = transfer.to;
                    record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
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
                        record.address = transfer.from;
                        record.alias = (await accountService.getAccountAliases([transfer.from]))[0];
                    }
                }
                break;
            case 'cancel_auction':
                {
                    const auctionId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftAuctionMap, auctionId.toString());
                    record.price = parseInt(content.value.start_price);
                    record.auctionId = auctionId;
                    record.address = transfer.to;
                    record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
                }
                break;
            case 'collect_bundle':
                record.address = transfer.to;
                record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
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
                        record.address = transfer.from;
                        record.alias = (await accountService.getAccountAliases([transfer.from]))[0];
                    }
                }
                break;
            case 'cancel_bundle':
                {
                    const bundleId = parseInt(operation.parameters);
                    const content = await tzkt.getBigMapContent(config.nftBundleMap, bundleId.toString());
                    record.price = parseInt(content.value.xtz_per_bundle);
                    record.bundleId = bundleId;
                    record.address = transfer.to;
                    record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
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
                    const gachaPlayInfo = await gachaService.getGachaPlayInfo(_.range(startId, endId), transfer.to);
                    const gachaId = gachaPlayInfo[0].gachaId;
                    const gachaMap = gachaService.getNftGachaMap({gachaId: gachaId});
                    const content = await tzkt.getBigMapContent(gachaMap, gachaId.toString());
                    record.price = parseInt(content.value.xtz_per_gacha); 
                    record.type = 'collect_gacha';
                    record.gachaId = gachaId;
                    record.gachaTitle = (await gachaService.getGacha(record.gachaId))?.metadata.title;
                    record.address = transfer.to;
                    record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
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
                        record.address = transfer.from;
                        record.alias = (await accountService.getAccountAliases([transfer.from]))[0];
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
                    record.address = transfer.to;
                    record.alias = (await accountService.getAccountAliases([transfer.to]))[0];
                }
                break;
        }
        records.push(record);
    }));
    records.sort((a, b) => b.timestamp - a.timestamp);

    return records;
}

async function updateAkaObjTokenInfo(id: number, metadata: any) {
    const client = await mongodb.connectToDatabase();
    const database = client.db('akaSwap-DB');
    const filter = { tokenId : id };
    const options = { upsert: false };
    const updateDoc = {
        $set: metadata,
    };
    const result = await database.collection('akaObj-metadata').updateOne(filter, updateDoc, options);
    if (result.modifiedCount > 0) {
        console.log(`Update metadata of akaOBJ #${id}`);
    }
}

export default {
    getAkaObjOwners,
    getAllAkaObjIds,
    getAkaObjSwapsInfo,
    getAkaObjAuctionsInfo,
    getAkaObjBundlesInfo,
    getAkaObjGachasInfo,
    getAkaObjSalesInfo,
    getAkaObjIpfsHash,
    getAkaObjCreatorShares,
    getAkaObjTokenInfo,
    getAkaObj,
    getAkaObjRecords,
    updateAkaObjTokenInfo,
}