interface Bundle {
    banned?: boolean,
    bundleId: number,
    bundleAmount: number,
    issuer: string,
    alias: string,
    bundleItems: BundleItem[],
    metadata: PackMetadata,
    xtzPerBundle: number,
}

interface BundleItem {
    tokenId: number,
    amount: number,
    ipfsHash: string,
    tokenInfo?: TokenInfo,
}