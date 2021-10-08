import * as koa from 'koa';
import * as _ from 'lodash';

import ipfs from '../services/common/ipfs';

async function uploadDataToIpfs(ctx: koa.ParameterizedContext) {
    const files = ctx.request.files === undefined ?
        [] : _.isArray(ctx.request.files.file) ?
        ctx.request.files.file : [ctx.request.files.file];
    
    await ipfs.addDataToLocalIpfs(files);
    return files.length;
}

export {
    uploadDataToIpfs,
}
