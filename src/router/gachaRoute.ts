import axios from 'axios';
import * as koa from 'koa';

import config from '../config/config';
import utils from '../utils/utils';
import gachaService from '../services/gachaService';

async function getGachas(ctx: koa.ParameterizedContext) {
    const counter = typeof ctx.query.counter === 'string' ? parseInt(ctx.query.counter) : 0;
    const size = Math.min((typeof ctx.query.size === 'string' ? parseInt(ctx.query.size) : config.itemsPerPage), 30);
    const days = typeof ctx.query.days === 'string' ? parseInt(ctx.query.days) : 0;

    const gachas = await gachaService.getGachas('', days);
    const paginatedFeed = utils.paginateFeed(gachas, counter, size);

    await Promise.all(paginatedFeed.map(async (gacha) =>
        // await utils.fillGachaInfo(gacha)
        Object.assign(
            gacha, 
            (await axios.get(`http://127.0.0.1:${config.serverPort}/gachas/${gacha.gachaId}`)).data.gacha
        )
    ));

    const feed = paginatedFeed
        // .filter(gacha => gacha.banned === undefined)
        .filter(gacha => gacha !== undefined)
        .sort((a, b) => b.gachaId - a.gachaId);

    return { 
        gachas: feed,
        hasMore: size * (counter + 1) < gachas.length,
    };
}

async function getGacha(ctx: koa.ParameterizedContext) {
    const gachaId = typeof ctx.params.gachaId === 'string' ? parseInt(ctx.params.gachaId) : 0;
    
    const gacha = await gachaService.getGacha(gachaId);
    if (gacha === null) {
        return {};
    }
    await gachaService.fillGachaInfo(gacha);

    return gacha.banned !== undefined ? { banned: true } : { gacha: gacha };
}

async function getGachaRecords(ctx: koa.ParameterizedContext) {
    const gachaId = typeof ctx.params.gachaId === 'string' ? parseInt(ctx.params.gachaId) : 0;
    
    const gacha = (await axios.get(`http://127.0.0.1:${config.serverPort}/gachas/${gachaId}`)).data
    if (gacha.gacha === undefined) {
        return { banned: gacha.banned };
    }

    const records = await gachaService.getGachaRecords(gachaId);

    return { records };
}

export {
    getGachas,
    getGacha,
    getGachaRecords,
}
