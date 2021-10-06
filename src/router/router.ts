import * as koa from 'koa';
import * as koaRouter from 'koa-router';

import config from '../config/config';
import utils from '../utils/utils';
import { getUserAkaDao, getUserCreations, getUserCollections, getUserAuctions, getUserBundles, getUserGachas, getUserRecords, getUserAkaObjs, updateAccountMetadata } from './accountRoute';
import { getAkaObjs, getAkaObj, getAkaObjRecords, getAkaObjsByTag, getAkaObjsByCuration } from './akaObjRoute';
import { getAuction, getAuctions } from './auctionRoute';
import { getBundle, getBundles } from './bundleRoute';
import { getGacha, getGachaRecords, getGachas } from './gachaRoute';
import { getTags } from './tagRoute';

const CACHE_TIME = config.cacheTime * utils.MILLISECOND_MODIFIER
const CACHE_UPDATE_TIME = config.cacheUpdateTime * utils.MILLISECOND_MODIFIER
const dataCache: any = {};

async function checkCache(ctx: koa.ParameterizedContext, callback: Function) {
    const time = Date.now();
    if (dataCache.hasOwnProperty(ctx.request.url) &&
        time - dataCache[ctx.request.url].timestamp < CACHE_TIME) {
        const cache = dataCache[ctx.request.url].cache;
        if (time - dataCache[ctx.request.url].timestamp > CACHE_UPDATE_TIME) {
            dataCache[ctx.request.url].timestamp = time;
            updateCache(ctx, time, callback);
        }
        return cache;
    } else {
        dataCache[ctx.request.url] = { cache: await callback(), timestamp: time };
        return dataCache[ctx.request.url].cache;
    }
}

async function updateCache(ctx: koa.ParameterizedContext, time: number, callback: Function) {
    callback().then((data: any) => 
        dataCache[ctx.request.url] = { cache: data, timestamp: time }
    )
}

const router = new koaRouter();

router
    .get('/tags', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getTags(ctx));
        await next();
    })

    .get('/akaobjs', async (ctx, next) => {
        const byTag = ctx.query.tag !== undefined;
        const byCuration = ctx.query.curation !== undefined;
        if (byTag) {
            ctx.body = await checkCache(ctx, async () => getAkaObjsByTag(ctx));
        } else if (byCuration) {
            ctx.body = await checkCache(ctx, async () => getAkaObjsByCuration(ctx));
        } else {
            ctx.body = await checkCache(ctx, async () => getAkaObjs(ctx));
        }
        await next();
    })
    .get('/akaobjs/:tokenId', async (ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getAkaObj(ctx));
        await next();
    })
    .get('/akaobjs/:tokenId/records', async (ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getAkaObjRecords(ctx));
        await next();
    })

    .get('/accounts/:address/akadao', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserAkaDao(ctx));
        await next();
    })
    .get('/accounts/:address/creations', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserCreations(ctx));
        await next();
    })
    .get('/accounts/:address/collections', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserCollections(ctx));
        await next();
    })
    .get('/accounts/:address/auctions', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserAuctions(ctx));
        await next();
    })
    .get('/accounts/:address/bundles', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserBundles(ctx));
        await next();
    })
    .get('/accounts/:address/gachas', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserGachas(ctx));
        await next();
    })
    .get('/accounts/:address/records', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserRecords(ctx));
        await next();
    })
    .get('/accounts/:address/akaobjs', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getUserAkaObjs(ctx));
        await next();
    })

    .get('/auctions', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getAuctions(ctx));
        await next();
    })
    .get('/auctions/:auctionId', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getAuction(ctx));
        await next();
    })

    .get('/bundles', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getBundles(ctx));
        await next();
    })
    .get('/bundles/:bundleId', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getBundle(ctx));
        await next();
    })

    .get('/gachas', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getGachas(ctx));
        await next();
    })
    .get('/gachas/:gachaId', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getGacha(ctx));
        await next();
    })
    .get('/gachas/:gachaId/records', async(ctx, next) => {
        ctx.body = await checkCache(ctx, async () => getGachaRecords(ctx));
        await next();
    })

    .post('/internal/accounts/:address/metadata', async(ctx, next) => {
        updateAccountMetadata(ctx);
        ctx.response.status = 204;
        await next();
    })

export {
    router
}
