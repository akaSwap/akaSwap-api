import * as conseiljs from 'conseiljs';
import * as _ from 'lodash';

import config from '../config/config';
import utils from '../utils/utils';
import pack from './common/pack';
import pattern from './common/pattern';
import accountService from './accountService';
import akaObjService from './akaObjService';

async function getBundle(bundleId: number): Promise<Bundle | null> {
    let bundleQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    bundleQuery = conseiljs.ConseilQueryBuilder.addFields(
        bundleQuery,
        'key',
        'value'
    );
    bundleQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bundleQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [config.nftBundleMap]
    );
    bundleQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        bundleQuery,
        'key',
        conseiljs.ConseilOperator.EQ,
        [bundleId]
    );
    bundleQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        bundleQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    );
    bundleQuery = conseiljs.ConseilQueryBuilder.setLimit(bundleQuery, 1);

    const bundleResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        bundleQuery
    );

    try {
        const row = bundleResult[0];
        const match = pattern.bundleStorageRegExp.exec(row['value']);

        if (match?.some) {
            const bundleId = parseInt(row['key']);
            const items = match[2].split(' ; ');
            const issuer = conseiljs.TezosMessageUtils.readAddress(match[3]);

            const bundleItems = await Promise.all(items.map(async (item) => {
                const data = item.split(' ');
                const id = parseInt(data[1]);
                return {
                    tokenId: id,
                    amount: parseInt(data[2]),
                    ipfsHash: await akaObjService.getAkaObjIpfsHash(id),
                }
            }));
            return {
                bundleId: bundleId,
                bundleAmount: parseInt(match[1]),
                issuer: issuer,
                alias: (await accountService.getAccountAliases([issuer]))[0],
                bundleItems: bundleItems,
                metadata: await pack.getPackMetadata({ bundleId, ipfsHash: match[4], issuer }, 'GachaBundle'),
                xtzPerBundle: parseInt(match[5]),
            };
        }
    } catch (error) {
        console.log(`failed to get bundle by ${bundleId} with ${error}`);
    }

    return null;
}

/**
 * Returns bundles. Since some days ago.
 * All: address = ''
 * Issuer address = 'tz...'
 */
async function getBundles(address: string, days = 0): Promise<Bundle[]> {
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
    if (days > 0) {
        const now = Date.now();
        bundlesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            bundlesQuery,
            'timestamp',
            conseiljs.ConseilOperator.BETWEEN,
            [utils.subtractDays(now, days), now]
        );
    }
    bundlesQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        bundlesQuery,
        'block_level',
        conseiljs.ConseilSortDirection.DESC
    );
    bundlesQuery = conseiljs.ConseilQueryBuilder.setLimit(bundlesQuery, 100000);
    
    let bundleStorageRegExp: RegExp;
    if (address === '') {
        bundleStorageRegExp = pattern.bundleStorageRegExp;
    } else {
        // need to fix
        const addrHash = `0x${conseiljs.TezosMessageUtils.writeAddress(address)}`;
        bundlesQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            bundlesQuery,
            'value',
            conseiljs.ConseilOperator.LIKE,
            [`; ${addrHash}`]
        );
        bundleStorageRegExp = new RegExp(
            `Pair ([0-9]+) [{] ([a-zA-Z0-9 ;]+) [}] ; (${addrHash}) ; ["](.*)["] ; ([0-9]+)`
        );
    }

    const bundlesResult = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        bundlesQuery
    );

    let bundles: Bundle[] = [];
    try {
        await Promise.all(bundlesResult.map(async (row) => {
            const match = bundleStorageRegExp.exec(row['value']);

            if (match?.some) {
                const bundleId = parseInt(row['key']);
                const items = match[2].split(' ; ');
                const issuer = address != '' ? address : conseiljs.TezosMessageUtils.readAddress(match[3]);

                const bundleItems = await Promise.all(items.map(async (item) => {
                    const data = item.split(' ');
                    const id = parseInt(data[1]);
                    return {
                        tokenId: id,
                        amount: parseInt(data[2]),
                        ipfsHash: await akaObjService.getAkaObjIpfsHash(id),
                    }
                }));
                bundles.push({
                    bundleId: bundleId,
                    bundleAmount: parseInt(match[1]),
                    issuer: issuer,
                    alias: (await accountService.getAccountAliases([issuer]))[0],
                    bundleItems: bundleItems,
                    metadata: await pack.getPackMetadata({ bundleId, ipfsHash: match[4], issuer }, 'GachaBundle'),
                    xtzPerBundle: parseInt(match[5]),
                });
            }
        }));
    } catch (error) {
        console.log(`failed to get bundle list for ${address} with ${error}`);
    }

    bundles.sort((a, b) => b.bundleId - a.bundleId);

    return bundles;
}

async function getCollectOperations(bundleId: number) {
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
        [config.akaBundle]
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
        ['collect_bundle']
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'parameters',
        conseiljs.ConseilOperator.ENDSWITH,
        [` ${bundleId}`]
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
    );

    return results.map((result) => {
        result.timestamp = result.timestamp / 1000;
        return result;
    });
}

async function fillBundleInfo(bundle: Bundle) {
    const [restrictedAkaObjs, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    let banned = false;
    await Promise.all(bundle.bundleItems.map(async (item) => {
        item.tokenInfo = await akaObjService.getAkaObjTokenInfo(item);
        if (restrictedAkaObjs.includes(item.tokenId) ||
            restrictedAddresses.includes(item.tokenInfo.creators[0])) {
            banned = true;
        }
    }));

    if (banned) {
        bundle.banned = true;
    }
}

export default {
    getBundle,
    getBundles,
    getCollectOperations,
    fillBundleInfo
}