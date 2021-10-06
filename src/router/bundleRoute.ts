import axios from 'axios';
import * as koa from 'koa';

import config from '../config/config';
import utils from '../utils/utils';
import bundleService from '../services/bundleService';

async function getBundles(ctx: koa.ParameterizedContext) {
    const counter = typeof ctx.query.counter === 'string' ? parseInt(ctx.query.counter) : 0;
    const size = Math.min((typeof ctx.query.size === 'string' ? parseInt(ctx.query.size) : config.itemsPerPage), 30);

    const bundles = await bundleService.getBundles('');
    const paginatedFeed = utils.paginateFeed(bundles, counter, size);

    await Promise.all(paginatedFeed.map(async (bundle) =>
        // await utils.fillBundleInfo(bundle)
        Object.assign(
            bundle, 
            (await axios.get(`http://127.0.0.1:${config.serverPort}/bundles/${bundle.bundleId}`)).data.bundle
        )
    ));

    const feed = paginatedFeed
        // .filter(bundle => bundle.banned === undefined)
        .filter(bundle => bundle !== undefined && bundle.banned === undefined)
        .sort((a, b) => b.bundleId - a.bundleId);

    return { 
        bundles: feed,
        hasMore: size * (counter + 1) < bundles.length,
    };
}

async function getBundle(ctx: koa.ParameterizedContext) {
    const bundleId = typeof ctx.params.bundleId === 'string' ? parseInt(ctx.params.bundleId) : 0;
    
    const bundle = await bundleService.getBundle(bundleId);
    if (bundle === null) {
        return {};
    }
    await bundleService.fillBundleInfo(bundle);

    return bundle.banned !== undefined ? { banned: true } : { bundle: bundle };
}

export {
    getBundles,
    getBundle,
}
