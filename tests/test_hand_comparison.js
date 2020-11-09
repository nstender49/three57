
TEST_HANDS = [
    "3H,KS,2H",              // pair w/ wild
    "2C,4C,5C",              // high card
    "AH,KH,QH,3D,10H",       // royal flush w/ wild
    "AH,KH,QH,3D,10C",       // straight w/ wild
    "AC,KH,10S,9H,8D,3D,7S", // straight w/ wild, not ace
    "2D,2H,6C,6D,3H",         // full house 6 over 2 w/ wild\
    "AH,AD,QS,KS,JD",         // QAKAJ
    "AH,AD,QS,3D,JD",         // Failed QAKAJ, no wilds! trip aces
    "5H,5D,3C,6S,5S,3H,AC",   // 5 of a kind, 5s
    "5H,4H,2H,3D,AH,6C",      // straight flush, 5 high, hearts
    "4C,3C,2H,AD,5S",         // straight 5 high, natural (wild doesn't matter)
    "5H,8H,KH,5D,QH,6H,7H",   // flush K high
    "5H,8H,3S,5D,QH,2H,JH",   // flush w/ wild, "A" high
    "7H,4C,4S,7S,2D",         // two pair 7 over 4 natural
    "AH,KH,QH,6S,6D",         // pair 6's, A kicker natural
    "AH,KH,QH,6S,3D",         // pair A's, K kicker w/ wild
    "KD,3D,3H,3C,3S,QS,QC",   // 5 of a kind, K
    "3D,3H,3C,3S,3D",         // 5 of a kind, all wilds
    "3D,3H,3C",               // 3 of a kind, all wilds
];

for (var hand of TEST_HANDS) {
    var result = getBestHand(convertStringHand(hand), settings);
}

function convertStringHand(h) {
    hand = [];
    for (var card of h.split(",")) {
        hand.push({value: card.slice(0, card.length - 1), suit: card.slice(card.length - 1)});
    }
    return hand;
}