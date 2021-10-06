import axios from 'axios';
import * as koa from 'koa';

import config from '../config/config';
import utils from '../utils/utils';
import auctionService from '../services/auctionService';

async function getAuctions(ctx: koa.ParameterizedContext) {
    const counter = typeof ctx.query.counter === 'string' ? parseInt(ctx.query.counter) : 0;
    const size = Math.min((typeof ctx.query.size === 'string' ? parseInt(ctx.query.size) : config.itemsPerPage), 30);
    const days = typeof ctx.query.days === 'string' ? parseInt(ctx.query.days) : 0;

    const auctions = await auctionService.getAuctions('', days);
    const paginatedFeed = utils.paginateFeed(auctions, counter, size);

    await Promise.all(paginatedFeed.map(async (auction) =>
        // await utils.fillAuctionInfo(auction)
        Object.assign(
            auction, 
            (await axios.get(`http://127.0.0.1:${config.serverPort}/auctions/${auction.auctionId}`)).data.auction
        )
    ));

    const feed = paginatedFeed
        .filter(auction => auction !== undefined)
        .sort((a, b) => b.auctionId - a.auctionId);

    return { 
        auctions: feed,
        hasMore: size * (counter + 1) < auctions.length,
    };
}

async function getAuction(ctx: koa.ParameterizedContext) {
    const auctionId = typeof ctx.params.auctionId === 'string' ? parseInt(ctx.params.auctionId) : 0;

    const auction = await auctionService.getAuction(auctionId);
    if (auction === null) {
        return {};
    }
    await auctionService.fillAuctionInfo(auction);

    return auction.banned !== undefined ? { banned: true } : { auction: auction };
}

export {
    getAuctions,
    getAuction,
}
