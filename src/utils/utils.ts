import axios from 'axios';
import * as _ from 'lodash';

import config from "../config/config";
import * as mongodb from './mongodb';

const MILLISECOND_MODIFIER = 1000;
const ONE_MINUTE_MILLIS = 60 * MILLISECOND_MODIFIER;
const ONE_HOUR_MILLIS = 60 * ONE_MINUTE_MILLIS;
const ONE_DAY_MILLIS = 24 * ONE_HOUR_MILLIS;
const ONE_WEEK_MILLIS = 7 * ONE_DAY_MILLIS;

function getMinTime() {
    var d = new Date();
    d.setDate(d.getDate() - 14);
    return d.getTime();
}

function subtractWeek(timestamp: number) {
    return timestamp - ONE_WEEK_MILLIS;
}

function subtractDays(timestamp: number, days: number) {
    return timestamp - (ONE_DAY_MILLIS * days);
}

function subtractHours(timestamp: number, hours: number) {
    return timestamp - (ONE_HOUR_MILLIS * hours);
}

function floorTimeToMinute(currentTime: number) {
    return Math.floor(currentTime / ONE_MINUTE_MILLIS) * ONE_MINUTE_MILLIS;
}

function getTimeQuantizedToMinute() {
    return floorTimeToMinute((new Date()).getTime());
}

function paginateFeed<T>(feed: T[], cursor: number, itemsPerPage: number) {
    return feed.slice(
        cursor * itemsPerPage,
        cursor * itemsPerPage + itemsPerPage
    )
}

function toInt(value: string | number) {
    return typeof value === 'string' ? parseInt(value) : value;
}

async function getFeaturedAddresses(): Promise<string[]> {
    return (
        await axios.get(
            `${config.apiUrl}/list/featured.json`
        )
    ).data;
}

async function getRestrictedAddresses(): Promise<string[]> {
    return (
        await axios.get(
            `${config.apiUrl}/list/wallet.json`
        )
    ).data;
}

async function getRestrictedTokenIds(): Promise<number[]> {
    return (
        await axios.get(
            `${config.apiUrl}/list/akaobj.json`
        )
    ).data;
}

async function getBurnedTokenIds(): Promise<number[]> {
    const client = await mongodb.connectToDatabase();
    const burnedListInfo = await client
        .db('akaSwap-DB')
        .collection('list')
        .findOne({ title: 'burned' });
    const burnedTokenIds: number[] = burnedListInfo.data;
    return burnedTokenIds;
}

async function getCurations() {
    return (
        await axios.get(
            `${config.apiUrl}/list/gallery_list.json`
        )
    ).data;
}

export default {
    MILLISECOND_MODIFIER,
    ONE_WEEK_MILLIS,
    getMinTime,
    subtractWeek,
    subtractDays,
    subtractHours,
    floorTimeToMinute,
    getTimeQuantizedToMinute,
    paginateFeed,
    toInt,
    getFeaturedAddresses,
    getRestrictedAddresses,
    getRestrictedTokenIds,
    getBurnedTokenIds,
    getCurations,
}