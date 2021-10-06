import * as koa from 'koa';
import * as _ from 'lodash';

import * as mongodb from '../utils/mongodb';
import utils from '../utils/utils';

async function getTags(ctx: koa.ParameterizedContext) {
    const [client, restrictedTokenIds, restrictedAddresses, burnedTokenIds] = await Promise.all([
        mongodb.connectToDatabase(),
        utils.getRestrictedTokenIds(),
        utils.getRestrictedAddresses(),
        utils.getBurnedTokenIds(),
    ]);

    const hiddenTokenIds = _.union(restrictedTokenIds, burnedTokenIds);

    const database = client.db('akaSwap-DB');
    const metadata = database.collection('akaObj-metadata');
    const aggCursor = metadata.aggregate([
        {
            $match: {
                tokenId: { $not: { $in: hiddenTokenIds } },
                'creators.0': { $not: { $in: restrictedAddresses } },
                tags: { $not: { $size: 0 }, $ne: '' }
            }
        },
        { $unwind: '$tags' },
        {
            $group: {
                _id: '$tags',
                count: { $sum: 1 }
            }
        },
        {
            $match: {
                count: { $gt: 1 }
            }
        },
        { $sort : { _id : 1 } }
    ]);
    const tags: string[] = [];
    await aggCursor.forEach((data: any) => tags.push(data._id));
    
    return { tags };
}

export {
    getTags,
}
