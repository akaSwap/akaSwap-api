interface Gacha {
    banned?: boolean,
    gachaId: number,
    cancelTime: number,
    gachaAmount: number,
    gachaTotal: number,
    gachaPlayRemains: number,
    issueTime: number,
    issuer: string,
    alias: string,
    gachaItems: GachaItem[],
    lastPrizeTokenId: number,
    lastPrize: {
        tokenId: number,
        ipfsHash: string,
        tokenInfo?: TokenInfo,
    },
    metadata: PackMetadata,
    xtzPerGacha: number,
}

interface GachaItem {
    tokenId: number,
    remain: number,
    total: number,
    ipfsHash: string,
    tokenInfo?: TokenInfo,
}