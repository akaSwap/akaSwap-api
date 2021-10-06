import config from "../../config/config";

export default {
    // Pair (Pair 33 212) (Pair { Elt "tz1RcZpvwrjxzntWTE5AHof3os1Q9P4CUxZM" 1000 } 330000)
    swapParametersRegExp: RegExp(
        `Pair [(]Pair [0-9]+ [0-9]+[)] [(]Pair [{] ["a-zA-Z0-9 ;]+ [}] ([0-9]+)[)]`
    ),
    
    // { Pair 6 0 ; 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 ; 0 ; 10000000000000000 } ; Pair 1624526785 0x00002a2e7603fbf6ec6c872f1281b2e7dbeac0c6e0e4 ; "QmbCMyJZDcAZBRQMYrb6YyTBNjtfn4pNaRhLnFAsr4sBKn" ; 5 ; 1000000
    auctionStorageRegExp: RegExp(
        `[{] Pair ([0-9]+) ([0-9]+) ; 0x([0-9a-z]{44}) ; ([0-9]+) ; ([0-9]+) [}] ; Pair ([0-9]+) 0x([0-9a-z]{44}) ; ["](.*)["] ; ([0-9]+) ; ([0-9]+)`
    ),
    // Pair (Pair 194 (Pair 14 27000000)) (Pair "QmZnX2E2z3xmdtavSsFNuvvUmFPfLCN1ivxMvtjGEM6aUo" (Pair 20 4000000))
    makeAuctionParametersRegExp: RegExp(
        `Pair [(]Pair [0-9]+ [(]Pair [0-9]+ [0-9]+[)][)] [(]Pair ["a-zA-Z0-9]+ [(]Pair [0-9]+ ([0-9]+)[)][)]`
    ),
    
    // Pair 10 { Elt 1 1 ; Elt 4 1 } ; 0x000056d6705eb537d3450dbd12c20094dc1d38af46b0 ; \"Nako Bundle!\" ; 50000000
    bundleStorageRegExp: RegExp(
        `Pair ([0-9]+) [{] ([a-zA-Z0-9 ;]+) [}] ; 0x([0-9a-z]{44}) ; ["](.*)["] ; ([0-9]+)`
    ),
    // Pair (Pair 3 { Elt 100 1 ; Elt 101 1 }) (Pair "QmeGkMrwFgYSnwMpjWtTXgYFCqwBowMtoBtS2VZqakXxCX" 7000000)
    makeBundleParametersRegExp: RegExp(
        `Pair [(]Pair [0-9]+ [{] ["a-zA-Z0-9 ;]+ [}][)] [(]Pair ["a-zA-Z0-9]+ ([0-9]+)[)]`
    ),

    // Pair (Pair 1623148475 61) (Pair { Elt 0 (Pair 30 30) ; Elt 1 (Pair 1 1) ; Elt 2 (Pair 30 30) } 61) ; Pair 1623062075 0x000056d6705eb537d3450dbd12c20094dc1d38af46b0 ; 1 ; "QmQUbfTUMJ1mBcsEc6ERKEqJSyoVYNpsFDX6EkSLK6TqfW" ; 1234567
    gachaStorageRegExp: RegExp(
        `Pair [(]Pair ([0-9]+) ([0-9]+)[)] [(]Pair [{] ([()a-zA-Z0-9 ;]+) [}] ([0-9]+)[)] ; Pair ([0-9]+) 0x([0-9a-z]{44}) ; ([0-9]+) ; ["](.*)["] ; ([0-9]+)`
    ),
    // Pair 1 (Pair 1 0x0000ce9b5081f371a479da8f9b6048af5bb37f217799)
    gachaPlayInfoStorageRegExp: RegExp(
        'Pair ([0-9]+) [(]Pair ([0-9]+) ([a-zA-Z0-9]+)[)]'
    ),
    makeGachaParametersRegExps: config.makeGachaParametersRegExps,

    // Pair 2 { Elt "" 0x697066733a2f2f516d503445734d344c726d51416f796f7077444b434a637534555453446966776153635668527932546a6b47586a }
    akaObjStorageRegExp: RegExp(
        `Pair ([0-9]+) [{] Elt ["]{2} 0x([a-zA-Z0-9]+) [}]`
    ),

    akaDaoLedgerStorageRegExp: RegExp(
        `Pair 0x([a-zA-Z0-9]+) ([0-9]+)`
    ),
    
    // Pair { Elt 0x000056d6705eb537d3450dbd12c20094dc1d38af46b0 50 ; Elt 0x000068f23e45874cdcb3c9c5b2c8b53f96715077da52 50 ; Elt 0x00006fec4b7c93429d4105f869c48f59974777e1afa7 150 } (Pair 0x00006fec4b7c93429d4105f869c48f59974777e1afa7 250)
    royaltyStorageRegExp: RegExp(
        `Pair [{] ([a-zA-Z0-9 ;]+) [}] [(]Pair 0x([0-9a-z]{44}) ([0-9]+)[)]`
    ),

    // Pair (Pair 0x0000d997b9b8bca3092e3b3d4d846c6efb75199dacb9 1) (Pair 473 { Elt "" 0x697066733a2f2f516d53626147797a65744d6e636b575677526f78676b6e536951396d674c3138344569546e36416d336b48315a68 })
    mintParametersRegExp: RegExp(
        `Pair [(]Pair 0x([a-zA-Z0-9]+) ([0-9]+)[)] [(]Pair ([0-9]+) [{] (["a-zA-Z0-9 ;]+) [}][)]`
    ),

    // { Pair 0x0196cccfad664605be2c4c1dbdd727cb8252c7363000 { Pair 0x0000f9d2e54357c593d519e7691196c50f7c878b65db (Pair 382 1) ; Pair 0x0000f9d2e54357c593d519e7691196c50f7c878b65db (Pair 372 1) } }
    transferParametersRegExp: RegExp(
        `[{] Pair (["a-zA-Z0-9]+) [{] (["()a-zA-Z0-9 ;]+) [}] [}]`
    ),
}