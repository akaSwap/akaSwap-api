import * as conseiljs from 'conseiljs';
import * as _ from 'lodash';

import config from '../../config/config';

async function getOperationOfEntrypoints(hash: string, entrypoints: string[]) {
    let operationsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    operationsQuery = conseiljs.ConseilQueryBuilder.addFields(
        operationsQuery,
        'amount',
        'parameters',
        'parameters_entrypoints',
        'block_level',
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'kind',
        conseiljs.ConseilOperator.EQ,
        ['transaction']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'operation_group_hash',
        conseiljs.ConseilOperator.EQ,
        [hash]
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'parameters_entrypoints',
        entrypoints.length > 1
            ? conseiljs.ConseilOperator.IN
            : conseiljs.ConseilOperator.EQ,
        entrypoints,
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.setLimit(operationsQuery, 1);

    const result: {
        amount: number,
        parameters: string,
        parameters_entrypoints: string,
        block_level: number,
    }[] = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'operations',
        operationsQuery
    );

    return result.length > 0 ? result[0] : null;
}

async function getOperationsByHash(hash: string, counter = -1) {
    let operationsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    operationsQuery = conseiljs.ConseilQueryBuilder.addFields(
        operationsQuery,
        'amount',
        'parameters',
        'parameters_entrypoints',
        'block_level',
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'kind',
        conseiljs.ConseilOperator.EQ,
        ['transaction']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'operation_group_hash',
        conseiljs.ConseilOperator.EQ,
        [hash]
    );
    if (counter >= 0) {
        operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
            operationsQuery,
            'counter',
            conseiljs.ConseilOperator.EQ,
            [counter]
        );
    }
    operationsQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        operationsQuery,
        'nonce',
        conseiljs.ConseilSortDirection.DESC
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        operationsQuery,
        'counter',
        conseiljs.ConseilSortDirection.DESC
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.setLimit(operationsQuery, 100);

    const result = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'operations',
        operationsQuery
    );

    return result;
}

async function getOperationsAtLevel(entrypoint: string, destination: string, level: number) {
    let operationsQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    operationsQuery = conseiljs.ConseilQueryBuilder.addFields(
        operationsQuery,
        'operation_group_hash',
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'kind',
        conseiljs.ConseilOperator.EQ,
        ['transaction']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'status',
        conseiljs.ConseilOperator.EQ,
        ['applied']
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'parameters_entrypoints',
        conseiljs.ConseilOperator.EQ,
        [entrypoint]
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'destination',
        conseiljs.ConseilOperator.EQ,
        [destination]
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        operationsQuery,
        'block_level',
        conseiljs.ConseilOperator.EQ,
        [level]
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.addOrdering(
        operationsQuery,
        'counter',
        conseiljs.ConseilSortDirection.ASC
    );
    operationsQuery = conseiljs.ConseilQueryBuilder.setLimit(operationsQuery, 100);
    const result = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'operations',
        operationsQuery
    );

    return result;
}

async function getKeyHash(bigMapId: number, key: string) {
    let keyHashQuery = conseiljs.ConseilQueryBuilder.blankQuery();
    keyHashQuery = conseiljs.ConseilQueryBuilder.addFields(
        keyHashQuery,
        'key_hash',
    );
    keyHashQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        keyHashQuery,
        'big_map_id',
        conseiljs.ConseilOperator.EQ,
        [bigMapId]
    );
    keyHashQuery = conseiljs.ConseilQueryBuilder.addPredicate(
        keyHashQuery,
        'key',
        conseiljs.ConseilOperator.EQ,
        [key]
    );
    keyHashQuery = conseiljs.ConseilQueryBuilder.setLimit(keyHashQuery, 1);
    const result = await conseiljs.TezosConseilClient.getTezosEntityData(
        { url: config.conseilServer, apiKey: config.conseilApiKey, network: config.conseilNetwork },
        config.conseilNetwork,
        'big_map_contents',
        keyHashQuery
    );

    return result[0].key_hash;
}

export default {
    getOperationOfEntrypoints,
    getOperationsByHash,
    getOperationsAtLevel,
    getKeyHash,
}