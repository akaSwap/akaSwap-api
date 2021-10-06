import axios from 'axios';
import * as koa from 'koa';
import * as _ from 'lodash';

import config from '../config/config';
import * as mongodb from '../utils/mongodb'
import utils from '../utils/utils';
import akaObjService from '../services/akaObjService';

async function getAkaObjs(ctx: koa.ParameterizedContext) {
    const counter = typeof ctx.query.counter === 'string' ? parseInt(ctx.query.counter) : 0;
    const size = Math.min((typeof ctx.query.size === 'string' ? parseInt(ctx.query.size) : config.itemsPerPage), 30);
    const random = typeof ctx.query.random === 'string' ? ctx.query.random === 'true' : false;
    const featured = typeof ctx.query.featured === 'string' ? ctx.query.featured === 'true' : false;

    const [rawFeed, restrictedTokenIds, restrictedAddresses, featuredAddress, burnedTokenIds] = await Promise.all([
        akaObjService.getAllAkaObjIds(),
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses(),
        utils.getFeaturedAddresses(),
        utils.getBurnedTokenIds(),
    ]);

    const hiddenTokenIds = _.union(restrictedTokenIds, burnedTokenIds);

    const filteredFeed = rawFeed.filter((token) => 
        !hiddenTokenIds.includes(token.tokenId) &&
        !restrictedAddresses.includes(token.minter) &&
        (featured ? featuredAddress.includes(token.minter) : true)
    );

    const paginatedFeed = random ?
        utils.paginateFeed(_.shuffle(filteredFeed), counter, size) :
        utils.paginateFeed(filteredFeed, counter, size);

    const feed = (await Promise.all<AkaObj>(
        paginatedFeed.map(async (token) =>
            // await utils.getAkaObjById(id)
            (await axios.get(`http://127.0.0.1:${config.serverPort}/akaobjs/${token.tokenId}`)).data.token
        )
    ))
    .filter(token => 
        // token !== null &&
        // !restrictedTokenIds.includes(token.tokenId) &&
        // !restrictedAddresses.includes(token.tokenInfo.creators[0])
        token !== undefined
    );

    return {
        tokens: feed,
        hasMore: size * (counter + 1) < filteredFeed.length,
    };
}

async function getAkaObj(ctx: koa.ParameterizedContext): Promise<{ banned?: boolean, token?: AkaObj }> {
    const tokenId = typeof ctx.params.tokenId === 'string' ? parseInt(ctx.params.tokenId) : 0;
    
    const [restrictedTokenIds, restrictedAddresses, burnedTokenIds] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses(),
        utils.getBurnedTokenIds(),
    ]);

    if (restrictedTokenIds.includes(tokenId)) {
        return { banned: true };
    }
    if (burnedTokenIds.includes(tokenId)) {
        return {};
    }

    const akaObj = await akaObjService.getAkaObj(tokenId);
    
    if (akaObj === null) {
        return {};
    }
    if (restrictedAddresses.includes(akaObj.tokenInfo.creators[0])) {
        return { banned: true };
    }

    return { token: akaObj };
}

async function getAkaObjRecords(ctx: koa.ParameterizedContext) {
    const tokenId = typeof ctx.params.tokenId === 'string' ? parseInt(ctx.params.tokenId) : 0;

    const akaObj: {
        banned: boolean,
        token: AkaObj,
    } = (await axios.get(`http://127.0.0.1:${config.serverPort}/akaobjs/${tokenId}`)).data;
    
    if (akaObj.token === undefined) {
        return { banned: akaObj.banned };
    }

    const records = await akaObjService.getAkaObjRecords(tokenId);

    return { records };
}

async function getAkaObjsByTag(ctx: koa.ParameterizedContext) {
    const counter = typeof ctx.query.counter === 'string' ? parseInt(ctx.query.counter) : 0;
    const size = Math.min((typeof ctx.query.size === 'string' ? parseInt(ctx.query.size) : config.itemsPerPage), 30);
    const tag = typeof ctx.query.tag === 'string' ? ctx.query.tag : '';
    const client = await mongodb.connectToDatabase();
    const database = client.db('akaSwap-DB');
    const metadata = database.collection('akaObj-metadata');
    let res = await metadata.find({ tags: tag }).collation({ locale: 'en', strength: 2 });
    res = await res.toArray();
    const tokens: {
        tokenId: number,
        minter: string,
    }[] = res.map((r: any) => {
        return {
            tokenId: r.tokenId,
            minter: r.creators[0],
        }
    });

    const [restrictedTokenIds, restrictedAddresses, burnedTokenIds] = await Promise.all([
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses(),
        utils.getBurnedTokenIds(),
    ]);

    const hiddenTokenIds = _.union(restrictedTokenIds, burnedTokenIds);

    const filteredFeed = tokens
        .filter((token) => 
            !hiddenTokenIds.includes(token.tokenId) &&
            !restrictedAddresses.includes(token.minter)
        )
        .sort((a, b) => b.tokenId - a.tokenId);

    const paginatedFeed = utils.paginateFeed(filteredFeed, counter, size);

    const feed = (await Promise.all<AkaObj>(paginatedFeed.map(async (token) => 
        // await utils.getAkaObjById(id)
        (await axios.get(`http://127.0.0.1:${config.serverPort}/akaobjs/${token.tokenId}`)).data.token
    )))
    .filter(token => 
        // token !== null &&
        // !restrictedTokenIds.includes(token.tokenId) &&
        // !restrictedAddresses.includes(token.tokenInfo.creators[0])
        token !== undefined
    );

    return {
        tokens: feed,
        hasMore: size * (counter + 1) < filteredFeed.length,
    };
}

async function getAkaObjsByCuration(ctx: koa.ParameterizedContext) {
    const curationName = typeof ctx.query.curation === 'string' ? ctx.query.curation : '';

    const curations = await utils.getCurations();

    let results: AkaObj[] = [];
    await Promise.all(curations.map(async (curation: any) => {
        if (curation.name === curationName) {
            results = (await Promise.all<AkaObj>(curation.akaOBJs.map(async (tokenId: number) => 
                // await utils.getAkaObjById(id)
                (await axios.get(`http://127.0.0.1:${config.serverPort}/akaobjs/${tokenId}`)).data.token
            )))
            .filter(o => 
                // o !== null &&
                // !restrictedAkaObjs.includes(o.tokenId) &&
                // !restrictedAddresses.includes(o.tokenInfo.creators[0])
                o !== undefined
            );
        }
    }))

    return { tokens: results };
}

export {
    getAkaObjs,
    getAkaObj,
    getAkaObjRecords,
    getAkaObjsByTag,
    getAkaObjsByCuration,
}
