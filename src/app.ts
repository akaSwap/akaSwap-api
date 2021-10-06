import * as koa from 'koa';
import * as json from 'koa-json';
import * as bodyparser from 'koa-bodyparser';
import * as cors from '@koa/cors';
import * as conseiljs from 'conseiljs';
import * as log from 'loglevel';
import fetch from 'node-fetch';

import config from './config/config';
import { router } from './router/router';

const logger = log.getLogger('conseiljs');
logger.setLevel('error', false);
// logger.setLevel('debug', false);
conseiljs.registerLogger(logger);
conseiljs.registerFetch(fetch);

const app = new koa();

app.use(cors());
app.use(json({ pretty: false }));
// app.use(json({ pretty: true }));
app.use(bodyparser());
app.use(router.routes())
// app.use(router.allowedMethods());

app.listen(config.serverPort, () => {
    console.log(`Server running on port: ${config.serverPort}`);
});