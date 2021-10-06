import * as conseiljs from 'conseiljs';
import * as _ from 'lodash';

import config from '../config/config';
import utils from '../utils/utils';
import pack from './common/pack';
import pattern from './common/pattern';
import accountService from './accountService';
import akaObjService from './akaObjService';

async function getAuction(auctionId: number): Promise<Auction | null> {
    let auctionQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    auctionQuery = conseiljs.ConseilQueryBuilder.addFields(
        auctionQuery,
        'key',
        'value'
    );
    auctionQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        auctionQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftAuctionMap]
    );
    auctionQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        auctionQuery,
        'key',
        conseiljs.ConseilOperator.EQ,
        [auctionId]
    );
    auctionQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        auctionQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    );
    auctionQuery = conseiljs.ConseilQueryBuilder.setLimit(auctionQuery, 1);

    const auctionResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        auctionQuery
    );

    try {
        const row = auctionResult[0];
        const match = pattern.auctionStorageRegExp.exec(row['value']);

        if (match?.some) {
            const issuer = conseiljs.TezosMessageUtils.readAddress(match[7]);
            const tokenId = parseInt(match[1]);
            const auctionId = parseInt(row['key']);
            const [ipfsHash, bidHistory] = await Promise.all([
                akaObjService.getAkaObjIpfsHash(tokenId),
                getBidHistory(auctionId)
            ]);
            const priceHistory = bidHistory.map(history => {
                return {
                    bidPrice: history.amount,
                    bidder: history.bidder,
                    alias: history.alias,
                    timestamp: history.timestamp,
                }
            });
            return {
                auctionId: auctionId,
                tokenId: tokenId,
                currentBidPrice: parseInt(match[2]),
                currentBidder: conseiljs.TezosMessageUtils.readAddress(match[3]),
                currentStorePrice: parseInt(match[4]),
                directPrice: parseInt(match[5]),
                dueTime: parseInt(match[6]),
                issuer: issuer,
                alias: (await accountService.getAccountAliases([issuer]))[0],
                metadata: await pack.getPackMetadata({ auctionId, ipfsHash: match[8], issuer }, 'Auction'),
                priceHistory: priceHistory,
                priceHistoryId: priceHistory.length,
                raisePercentage: parseInt(match[9]),
                startPrice: parseInt(match[10]),
                ipfsHash: ipfsHash,
            };
        }
    } catch (error) {
        console.log(`failed to get auction by ${auctionId} with ${error}`);
    }

    return null;
}

/**
 * Returns auctions. Since some days ago.
 * All: address = ''
 * Issuer address = 'tz...'
 */
async function getAuctions(address: string, days = 0): Promise<Auction[]> {
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
    if (days > 0) {
        const now = Date.now();
        auctionsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            auctionsQuery,
            'timestamp',
            conseiljs.ConseilOperator.BETWEEN,
            [utils.subtractDays(now, days), now]
        );
    }
    auctionsQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        auctionsQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    );
    auctionsQuery = conseiljs.ConseilQueryBuilder.setLimit(auctionsQuery, 100000);
    
    // { Pair 6 0 ; 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 ; 0 ; 10000000000000000 } ; Pair 1624526785 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 ; "QmbCMyJZDcAZBRQMYrb6YyTBNjtfn4pNaRhLnFAsr4sBKn" ; 5 ; 1000000
    let auctionStorageRegExp: RegExp;
    if (address === '') {
        auctionStorageRegExp = pattern.auctionStorageRegExp;
    } else {
        // need to fix
        const addrHash = `0x${conseiljs.TezosMessageUtils.writeAddress(address)}`;
        auctionsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            auctionsQuery,
            'value',
            conseiljs.ConseilOperator.LIKE,
            [`; ${addrHash}`]
        );
        auctionStorageRegExp = new RegExp(
            `[{] Pair ([0-9]+) ([0-9]+) ; 0x([0-9a-z]{44}) ; ([0-9]+) ; ([0-9]+) [}] ; Pair ([0-9]+) (${addrHash}) ; ["](.*)["] ; ([0-9]+) ; ([0-9]+)`
        );
    }

    const auctionsResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        auctionsQuery
    );

    let auctions: Auction[] = [];
    try {
        await Promise.all(auctionsResult.map(async (row) => {
            const match = auctionStorageRegExp.exec(row['value']);

            if (match?.some) {
                const issuer = address != '' ? address : conseiljs.TezosMessageUtils.readAddress(match[7]);
                const tokenId = parseInt(match[1])
                const auctionId = parseInt(row['key'])
                const [ipfsHash, bidHistory] = await Promise.all([
                    akaObjService.getAkaObjIpfsHash(tokenId),
                    getBidHistory(auctionId)
                ]);

                const priceHistory = bidHistory.map(history => {
                    return {
                        bidPrice: history.amount,
                        bidder: history.bidder,
                        alias: history.alias,
                        timestamp: history.timestamp
                    }
                });

                auctions.push({
                    auctionId: auctionId,
                    tokenId: tokenId,
                    currentBidPrice: parseInt(match[2]),
                    currentBidder: conseiljs.TezosMessageUtils.readAddress(match[3]),
                    currentStorePrice: parseInt(match[4]),
                    directPrice: parseInt(match[5]),
                    dueTime: parseInt(match[6]),
                    issuer: issuer,
                    alias: (await accountService.getAccountAliases([issuer]))[0],
                    metadata: await pack.getPackMetadata({ auctionId, ipfsHash: match[8], issuer }, 'Auction'),
                    priceHistory: priceHistory,
                    priceHistoryId: priceHistory.length,
                    raisePercentage: parseInt(match[9]),
                    startPrice: parseInt(match[10]),
                    ipfsHash: ipfsHash,
                });
            }
        }));
    } catch (error) {
        console.log(`failed to get auction list for ${address} with ${error}`);
    }

    auctions.sort((a, b) => b.auctionId - a.auctionId);

    return auctions;
}

async function getCollectOperations(auctionId: number) {
    let query = conseiljs.ConseilQueryBuilder.blankQuery();
    query = conseiljs.ConseilQueryBuilder.addFields(
        query,
        'timestamp',
        'parameters',
        'operation_group_hash',
        'counter'
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [config.akaAuction]
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
        conseiljs.ConseilOperator.IN,
        ['direct_purchase', 'close_auction']
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'parameters',
        conseiljs.ConseilOperator.ENDSWITH,
        [`${auctionId}`]
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
        operation_group_hash: string,
        counter: number,
    }[] = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'operations',
        query
    );

    return results.map((result) => {
        result.timestamp = result.timestamp / 1000;
        return result;
    });
}

async function getBidHistory(auctionId: number) {
    let queries: any[] = [];
    let bidAllQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    bidAllQuery = conseiljs.ConseilQueryBuilder.addFields(
        bidAllQuery,
        'source',
        'amount',
        'timestamp',
    );
    bidAllQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidAllQuery,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [config.akaAuction]
    );
    bidAllQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidAllQuery,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    bidAllQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidAllQuery,
        'parameters_entrypoints',
        conseiljs.ConseilOperator.EQ,
        ['bid_all']
    );
    bidAllQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidAllQuery,
        'parameters',
        conseiljs.ConseilOperator.EQ,
        [`${auctionId}`]
    );
    bidAllQuery = conseiljs.ConseilQueryBuilder.setLimit(bidAllQuery, 100000);
    queries.push(
        conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'operations',
            bidAllQuery
        )
    );
    let bidTenPercentQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    bidTenPercentQuery = conseiljs.ConseilQueryBuilder.addFields(
        bidTenPercentQuery,
        'parameters',
        'source',
        'amount',
        'timestamp',
    );
    bidTenPercentQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidTenPercentQuery,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [config.akaAuction]
    );
    bidTenPercentQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidTenPercentQuery,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    bidTenPercentQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidTenPercentQuery,
        'parameters_entrypoints',
        conseiljs.ConseilOperator.EQ,
        ['bid_ten_percent']
    );
    bidTenPercentQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bidTenPercentQuery,
        'parameters',
        conseiljs.ConseilOperator.STARTSWITH,
        [`Pair ${auctionId}`]
    );
    bidTenPercentQuery = conseiljs.ConseilQueryBuilder.setLimit(bidTenPercentQuery, 100000);
    queries.push(
        conseiljs.TezosConseilClient.getTezosEntityData(
            { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
            config.conseilNetwork,
            'operations',
            bidTenPercentQuery
        )
    );

    const [bidAllResults, bidTenPercentResults] = await Promise.all(queries);

    let bidHistory: {
        bidder: string,
        alias: string,
        amount: number,
        timestamp: number,
    }[] = [];
    await Promise.all([
        Promise.all(bidAllResults.map(async (result: any) => {
            const bidder = result.source;
            result.timestamp = result.timestamp / 1000;
            bidHistory.push({
                bidder: bidder,
                alias: (await accountService.getAccountAliases([bidder]))[0],
                amount: parseInt(result.amount),
                timestamp: result.timestamp
            });
        })),
        Promise.all(bidTenPercentResults.map(async (result: any) => {
            const bidder = result.source;
            result.timestamp = result.timestamp / 1000;
            const amount = result.parameters.split(' ')[2];
            bidHistory.push({
                bidder: bidder,
                alias: (await accountService.getAccountAliases([bidder]))[0],
                amount: parseInt(amount),
                timestamp: result.timestamp
            });
        })),
    ]);
    bidHistory = _.sortBy(bidHistory, ['timestamp']).reverse();
    return bidHistory;
}

async function fillAuctionInfo(auction: Auction) {
    const [tokenInfo, restrictedAkaObjs, restrictedAddresses] = await Promise.all([
        akaObjService.getAkaObjTokenInfo(auction),
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);
    auction.tokenInfo = tokenInfo;

    if (auction.priceHistoryId === 0 && 
        (restrictedAkaObjs.includes(auction.tokenId) ||
        restrictedAddresses.includes(auction.tokenInfo.creators[0]))) {
        auction.banned = true;
    }
}

export default {
    getAuction,
    getAuctions,
    getCollectOperations,
    getBidHistory,
    fillAuctionInfo
}