import * as conseiljs from 'conseiljs';

import config from '../config/config';

async function getCollectOperations(swapId: number) {
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
        [config.akaMetaverse]
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
        ['collect']
    );
    query = conseiljs.ConseilQueryBuilder.addPredicate(
        query,
        'parameters',
        conseiljs.ConseilOperator.ENDSWITH,
        [` ${swapId}`]
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
    )

    return results.map((result) => {
        result.timestamp = result.timestamp / 1000;
        return result;
    });
}

export default {
    getCollectOperations,
}