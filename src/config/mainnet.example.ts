export default {
    apiUrl: 'https://akaswap.com/api',
    serverPort: 3001,
    cacheTime: 600,
    cacheUpdateTime: 30,

    pinIpfs: true,
    pinataMetadataName: '',
    pinataApiKey: '',
    pinataSecretApiKey: '',
    
    localIpfsUrl: 'http://127.0.0.1:8080',

    mongodbUrl: '127.0.0.1:27017',
    mongodbUsername: '',
    mongodbPassword: '',

    conseilServer: 'https://conseil-prod.cryptonomic-infra.tech',
    conseilApiKey: '',
    conseilNetwork: 'mainnet',

    bcdServer: 'https://api.better-call.dev',
    bcdNetwork: 'mainnet',

    burnAddress: 'tz1burnburnburnburnburnburnburjAYjjX',
    itemsPerPage: 5,

    akaNftContract: 'KT1AFq5XorPduoYyWxs5gEyrFK6fVjJVbtCj',
    nftLedger: 6809,
    nftMetadataMap: 6812,

    akaMinter: 'KT1ULea6kxqiYe1A7CZVfMuGmTx7NmDGAph1',
    nftRoyaltiesMap: 6816,

    akaDaoToken: 'KT1AM3PV1cwmGRw28DVTgsjjsjHvmL6z4rGh',
    akaDaoAdmin: 'KT1QjeN8mDVWX4xpPVioGKBhBJFiMeT2pDof',
    akaDaoLedger: 6701,

    akaMetaverse: 'KT1HGL8vx7DP4xETVikL4LUYvFxSV19DxdFN',
    nftSwapMap: 6821,

    akaAuction: 'KT1CPzhw1UxAfdVYmeoMysVJLyA3fbvcqbi8',
    akaAuctionFund: 'KT1Rro1Mnb8fkV7saLh2h8af5br3nZ9Ns9aA',
    nftAuctionMap: 6829,
    raisePercentageMap: 6831,
    bidViolationMap: 6832,

    akaBundle: 'KT1NL8H5GTAWrVNbQUxxDzagRAURsdeV3Asz',
    nftBundleMap: 6826,

    akaGacha: [
        'KT1P1WJuRb9K62gdx1HfkNJwohLA5EmyCoQK',
        'KT1GsdckBVCsgqp6ERYLnyawyXACAAQspPv6'
    ],
    nftGachaPlayMap: [6822, 15889],
    nftGachaWhitelistMap: [6823, 15890],
    nftGachaMap: [6824, 15891],
    akaGachaId: [0, 8],
    akaGachaBlockLevel: [0, 1697163],
    akaGachaTimestamp: [0, 1631763322],
    akaGachaPlayId: [0, 179],

    // Pair (Pair 10 { Elt 181 (Pair 1 1) ; Elt 182 (Pair 2 2) ; Elt 183 (Pair 3 3) ; Elt 184 (Pair 3 3) ; Elt 185 (Pair 3 3) ; Elt 189 (Pair 32 32) ; Elt 190 (Pair 32 32) ; Elt 191 (Pair 32 32) }) (Pair 194 (Pair "QmYBDE3o28DY86eoF2QPZLLGkqKVxY77NJbJKWYheDQdCb" 250000))
    // Pair (Pair 1 (Pair { Elt 23 (Pair 1 1) } \"2021-09-02T08:40:00.000Z\")) (Pair 23 (Pair \"QmUCVQervbD2rCN8dP4mAAzGcPW78QgHfzVHT3x7agQex1\" 1000000))
    makeGachaParametersRegExps: [
        RegExp(`Pair [(]Pair [0-9]+ [{] [()"a-zA-Z0-9 ;]+ [}][)] [(]Pair [0-9]+ [(]Pair ["a-zA-Z0-9]+ ([0-9]+)[)][)]`),
        RegExp(`Pair [(]Pair [0-9]+ [(]Pair [{] [()"a-zA-Z0-9 ;]+ [}] ["][^"]+["][)][)] [(]Pair [0-9]+ [(]Pair ["a-zA-Z0-9]+ ([0-9]+)[)][)]`)
    ],
}