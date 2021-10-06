import * as koa from 'koa';
import * as _ from 'lodash';

import utils from '../utils/utils';
import config from '../config/config';
import accountService from '../services/accountService';
import akaObjService from '../services/akaObjService';
import auctionService from '../services/auctionService';
import bundleService from '../services/bundleService';
import gachaService from '../services/gachaService';

async function getUserAkaDao(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';

    const restrictedAddresses = await utils.getRestrictedAddresses();

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }
    
    const akaDao = await accountService.getAkaDaoBalance(issuerAddress);

    return { akaDao: akaDao };
}

async function getUserCreations(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';

    const [restrictedTokenIds, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }
    
    const creations = await accountService.getUserCreations(issuerAddress);
    const filteredCreations = await _filteredBurnedCreations(creations);
    const userCreations = await Promise.all(filteredCreations.map(async (akaObj: any) => {
        akaObj.tokenInfo = await akaObjService.getAkaObjTokenInfo(akaObj);
        if (restrictedTokenIds.includes(akaObj.tokenId) ||
            restrictedAddresses.includes(akaObj.tokenInfo.creators[0])) {
            akaObj.banned = true;
        }
        return akaObj;
    }));

    return { creations: userCreations };
}

async function getUserCollections(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';

    const [restrictedTokenIds, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }
    
    const ownAkaObjs = await accountService.getUserAkaObjs(issuerAddress);
    const userOwnAkaObjs = await Promise.all(ownAkaObjs.map(async (akaObj: any) => {
        akaObj.tokenInfo = await akaObjService.getAkaObjTokenInfo(akaObj);
        if (restrictedTokenIds.includes(akaObj.tokenId) ||
            restrictedAddresses.includes(akaObj.tokenInfo.creators[0])) {
            akaObj.banned = true;
        }
        return akaObj;
    }));
    const userCollections = userOwnAkaObjs.filter((akaObj) => akaObj.tokenInfo.creators[0] !== issuerAddress);

    return { collections: userCollections };
}

async function getUserAuctions(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';

    const [restrictedTokenIds, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }
    
    const auctions = await auctionService.getAuctions(issuerAddress, 0);
    await Promise.all(auctions.map((auction) => auctionService.fillAuctionInfo(auction)));

    return { auctions: auctions };
}

async function getUserBundles(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';

    const [restrictedTokenIds, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }
    
    const bundles = await bundleService.getBundles(issuerAddress, 0);
    await Promise.all(bundles.map((bundle) => bundleService.fillBundleInfo(bundle)));

    return { bundles: bundles };
}

async function getUserGachas(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';

    const [restrictedTokenIds, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }
    
    const gachas = await gachaService.getGachas(issuerAddress, 0);
    await Promise.all(gachas.map((gacha) => gachaService.fillGachaInfo(gacha)));

    return { gachas: gachas };
}

async function getUserRecords(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';

    const [restrictedTokenIds, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ]);

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }
    
    const records = await accountService.getUserRecords(issuerAddress);

    return { records: records };
}

async function _filteredBurnedCreations<T extends { tokenId: number }>(creations: T[]) {
    const validCreations: (T & { totalAmount: number })[] = [];

    await Promise.all(
        creations.map(async (c) => {
            const ownerData = await akaObjService.getAkaObjOwners(c.tokenId);

            const burnAddrCount = ownerData.owners[config.burnAddress] !== undefined ?
                ownerData.owners[config.burnAddress] : 0;
            const allIssuesBurned = burnAddrCount && burnAddrCount === ownerData.totalAmount;

            if (!allIssuesBurned) {
                validCreations.push({
                    ...c,
                    totalAmount: ownerData.totalAmount,
                });
            }
        })
    );

    return validCreations.sort((a, b) => b.tokenId - a.tokenId);
}

async function getUserAkaObjs(ctx: koa.ParameterizedContext) {
    const issuerAddress = typeof ctx.params.address === 'string' ? ctx.params.address : '';
    const withCollections = 
        typeof ctx.query.withCollections === 'string' ? ctx.query.withCollections !== 'false' : true;
    
    const [restrictedTokenIds, restrictedAddresses] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses()
    ])

    if (restrictedAddresses.includes(issuerAddress)) {
        return { banned: true };
    }

    const ownAkaObjs = await accountService.getUserAkaObjs(issuerAddress);

    let results = (await Promise.all(
        ownAkaObjs.map(async (akaObj: any) => {
            akaObj.tokenInfo = await akaObjService.getAkaObjTokenInfo(akaObj);
            if (restrictedTokenIds.includes(akaObj.tokenId) ||
                restrictedAddresses.includes(akaObj.tokenInfo.creators[0])) {
                akaObj.banned = true;
            }
            return akaObj;
        })
    )).filter(o => o.banned === undefined);

    if (!withCollections) {
        results = results.filter((r) => r.tokenInfo.creators[0] === issuerAddress);
    }

    return { tokens: results };
}

async function updateAccountMetadata(ctx: koa.ParameterizedContext) {
    const address: string = typeof ctx.params.address === 'string' ? ctx.params.address : '';
    
    if ((address.startsWith('tz') || address.startsWith('KT')) && address.length === 36) {
        accountService.updateAccountMetadata(address);
    }
}

export {
    getUserAkaDao,
    getUserCreations,
    getUserCollections,
    getUserAuctions,
    getUserBundles,
    getUserGachas,
    getUserRecords,
    getUserAkaObjs,
    updateAccountMetadata,
}