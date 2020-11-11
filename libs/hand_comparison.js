var WIN = "win";
var TIE = "tie";
var LOSE = "lose";

module.exports.getWinner = function(players, settings) {
    var winners = []
    var bestResult = undefined;
    for (var player of players) {
        var result = getBestHand(player.hand, settings);
        var compare = compareResults(result, bestResult);
        if (compare === WIN) {
            winners = [player.socket.id];
            bestResult = result;
        } else if (compare === TIE) {
            winners.push(player.socket.id);
        }
    }
    return {
        winners: winners,
        bestHand: handToString(bestResult),
    }
    // testHands(settings);
}

{
function testHands(settings) {
    TEST_HANDS = [
        "3H,KS,2H",              // pair w/ wild
        "2C,4C,5C",              // high card
        "AH,KH,QH,3D,10H",       // royal flush w/ wild
        "AH,KH,QH,3D,10C",       // A high straight w/ wild
        "AC,KH,10S,9H,8D,3D,7S", // J high straight w/ wild
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
        console.log(result);
    }
}

function convertStringHand(h) {
    hand = [];
    for (var card of h.split(",")) {
        hand.push({value: card.slice(0, card.length - 1), suit: card.slice(card.length - 1)});
    }
    return hand;
}
}

function compareResults(result, bestResult) {
    if (!bestResult) {
        return WIN;
    }
    // Compare ranks
    if (HAND_RANKINGS[result.hand] != HAND_RANKINGS[bestResult.hand]) {
        return HAND_RANKINGS[result.hand] < HAND_RANKINGS[bestResult.hand] ? WIN : LOSE;
    }
    // Compare value
    if (result.value != bestResult.value) {
        return lt(bestResult.value, result.value) ? WIN : LOSE;
    }
    // Compare kickers
    if (!result.kickers) {
        return TIE;
    }
    for (var i = 0; i < result.kickers.length; ++i) {
        if (result.kickers[i] != bestResult.kickers[i]) {
            return lt(bestResult.kickers[i], result.kickers[i]) ? WIN : LOSE;
        }
    }
    return TIE;
}

function handToString(result) {
    switch(result.hand) {
        case QAKAJ:
            return "QuAKAJack";
        case FIVE_OF_A_KIND:
            return "5-of-a-Kind " + result.value + "s";            
        case ROYAL_FLUSH:
            return "Royal Flush";
        case STRAIGHT_FLUSH:
            return result.value + " high Straight Flush";
        case FOUR_OF_A_KIND:
            return "4-of-a-Kind " + result.value + "s, kicker: " + result.kickers[0]; 
        case FULL_HOUSE:
            return "Full House " + result.value + "s over " + result.kickers[0] + "s";
        case FLUSH:
            return result.value + " high Flush";
        case STRAIGHT:
            return result.value + " high Straight";
        case THREE_OF_A_KIND:
            var s = "3-of-a-Kind " + result.value + "s";
            if (result.kickers && result.kickers.length > 0) {
                s += ", kickers: " + result.kickers.join(", ");
            }
            return s;
        case TWO_PAIR:
            return "Two Pair " + result.value + "s over " + result.kickers[0] + "s, kicker: " + result.kickers[1];
        case ONE_PAIR:
            var s = "Pair of " + result.value + "s";
            if (result.kickers && result.kickers.length > 0) {
                s += ", kickers: " + result.kickers.join(", ");
            }
            return s;
        case HIGH_CARD:
            return "High Card: " + [result.value].concat(result.kickers).join("-");
    }            
}


// Card value order.
var ORDER = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
var STR_ORDER = ORDER.concat(["A"]);
var SUITS = ["C", "D", "H", "S"];

// Hand names
var QAKAJ = "QAKAJ";
var FIVE_OF_A_KIND = "FIVE_OF_A_KIND";
var ROYAL_FLUSH = "ROYAL_FLUSH";
var STRAIGHT_FLUSH = "STRAIGHT_FLUSH";
var FOUR_OF_A_KIND = "FOUR_OF_A_KIND";
var FULL_HOUSE = "FULL_HOUSE";
var FLUSH = "FLUSH";
var STRAIGHT = "STRAIGHT";
var THREE_OF_A_KIND = "THREE_OF_A_KIND";
var TWO_PAIR = "TWO_PAIR";
var ONE_PAIR = "ONE_PAIR";
var HIGH_CARD = "HIGH_CARD";

var HAND_RANKINGS = {
    QAKAJ: 1,
    FIVE_OF_A_KIND: 2,
    ROYAL_FLUSH: 3,
    STRAIGHT_FLUSH: 4,
    FOUR_OF_A_KIND: 5,
    FULL_HOUSE: 6,
    FLUSH: 7,
    STRAIGHT: 8,
    THREE_OF_A_KIND: 9,
    TWO_PAIR: 10,
    ONE_PAIR: 11,
    HIGH_CARD: 12,
}

function getBestHand(hand, settings) {
    var suits = {};
    var values = {};
    var wildCount = 0;
    var handSize = Math.min(hand.length, 5);

    // Count suits and values.
    for (var card of hand) {
        console.log("CARD: " + card.value + " " + card.suit);
        if (settings.wilds.indexOf(card.value) != -1) {
            wildCount += 1;
            continue;
        }
        suits[card.suit] = (suits[card.suit] ? suits[card.suit] : 0) + 1;
        values[card.value] = (values[card.value] ? values[card.value] : 0) + 1;
    }

    // Check for hands in descending rank order.
    
    // QAKAJ
    if (settings.qakaj && hasQAKAJ(values)) {
        return {hand: QAKAJ}
    }

    // Get card with highest count and value.
    var countResult = getLargestSet(values);

    if (hand.length >= 5) {
        // FIVE_OF_A_KIND
        if (settings.five_of_a_kind && countResult.count + wildCount >= 5) {
            return {hand: FIVE_OF_A_KIND, value: getHighCard(values, [], 5 - wildCount)}
        }

        // ROYAL FLUSH / STRAIGHT FLUSH
        var flushResult = checkFlush(suits, wildCount, hand);
        var straightResult = checkStraight(values, wildCount);
        if (flushResult.result && straightResult.result) {
            var sfResult = checkStraightFlush(hand, values, suits, wildCount);
            if (sfResult.result) {
                if (sfResult.value === "A") {
                    return {hand: ROYAL_FLUSH}
                } else {
                    return {hand: STRAIGHT_FLUSH, value: sfResult.value}
                }
            }
        }

        // FOUR_OF_A_KIND
        if (countResult.count + wildCount >= 4) {
            var quad = getHighCard(values, [], 4 - wildCount)
            return {hand: FOUR_OF_A_KIND, value: quad, kickers: [getHighCard(values, [quad])]}
        }

        // FULL HOUSE
        if (countResult.count + wildCount >= 3) {
            fhResult = checkFullHouse(values, wildCount);
            if (fhResult.result) {
                return {hand: FULL_HOUSE, value: fhResult.trip, kickers: [fhResult.pair]}
            }
        }

        // FLUSH
        if (flushResult.result) {
            return {hand: FLUSH, value: flushResult.value};
        }

        // STRAIGHT
        if (straightResult.result) {
            return {hand: STRAIGHT, value: straightResult.value};
        }
    }

    // THREE_OF_A_KIND
    if (countResult.count + wildCount >= 3) {
        var trip = getHighCard(values, [], 3 - wildCount)
        return {hand: THREE_OF_A_KIND, value: trip, kickers: getKickers(values, handSize - 3, [trip])};
    }

    // PAIRS
    if (countResult.count + wildCount >= 2) {
        // If we had two wilds, we'd have at least trips, so we must have max 1 wild.
        if (wildCount === 1) {
            // If we had a natural pair, we'd have trips, so best we can do is one pair.
            return {hand: ONE_PAIR, value: countResult.value, kickers: getKickers(values, handSize - 2, [countResult.value])};
        }
        // See if we have a second natural pair.
        secondVal = getHighCard(values, [countResult.value], 2);
        if (secondVal) {
            return {hand: TWO_PAIR, value: countResult.value, kickers: [secondVal].concat(getKickers(values, handSize - 4, [countResult.value, secondVal]))};
        }
        // ONE_PAIR
        return {hand: ONE_PAIR, value: countResult.value, kickers: getKickers(values, handSize - 2, [countResult.value])};
    }
    
    // HIGH CARD
    ranked = getKickers(values, handSize, []);
    return {hand: HIGH_CARD, value: ranked.splice(0, 1)[0], kickers: ranked.splice(0)};
}

function getKickers(values, numKickers, excludeValues) {
    var kickers = []
    while (kickers.length < numKickers) {
        var kicker = getHighCard(values, excludeValues);
        kickers.push(kicker);
        excludeValues.push(kicker);
    }
    return kickers;
}

function getHighCard(values, excludeValues = [], minCount = 1) {
    for (var val of ORDER) {
        if (excludeValues.indexOf(val) > -1) {
            continue;
        }
        if ((values[val] || 0) >= minCount) {
            return val;
        }
    }
    return false
}

function hasQAKAJ(values) {
    // Wilds are not counted.
    return values["Q"] > 0 && values["A"] > 1 && values["K"] > 0 && values["J"] > 0; 
}

function getLargestSet(values) {
    var maxValue = undefined;
    var maxCount = 0;
    for (var value in values) {
        if (!maxCount || values[value] > maxCount) {
            maxValue = value;
            maxCount = values[value];
        } else if (values[value] === maxCount && lt(maxValue, value)) {
            maxValue = value;
        }
    }
    return {value: maxValue, count: maxCount}
}

function checkFlush(suits, wildCount, hand) {
    maxValue = undefined;
    for (var suit in suits) {
        if (suits[suit] + wildCount >= 5) {
            if (wildCount > 0) {
                return {result: true, value: "A"}
            }
            for (var card of hand) {
                if (card.suit === suit && (!maxValue || lt(maxValue, card.value))) {
                    maxValue = card.value;
                    if (maxValue === "A") {
                        return {result: true, value: "A"};
                    }
                }
            }
            return {result: true, value: maxValue};
        }
    }
    return {result: false};
}

function checkStraight(values, wildCount) {
    if (wildCount >= 5) {
        return {result: true, value: "A"}
    }
    for (var i = 0; i < 10; ++i) {
        var wildsLeft = wildCount;
        var failed = false;
        for (var j = 0; j < 5; ++j) {
            if (values[STR_ORDER[i + j]] > 0) {
                continue;
            }
            if (wildsLeft === 0) {
                failed = true;
                break;
            }
            wildsLeft -= 1;
        }
        if (!failed) {
            return {result: true, value: STR_ORDER[i]}
        }
    }
    return {result: false};
}

function checkStraightFlush(hand, values, suits, wildCount) {
    if (wildCount >= 5) {
        return {result: true, value: "A"}
    }
    for (var i = 0; i < 10; ++i) {
        for (var suit of SUITS) {
            if (!suits[suit] || suits[suit] + wildCount < 5) {
                continue;
            }
            var wildsLeft = wildCount;
            var failed = false;
            for (var j = 0; j < 5; ++j) {
                // Check if card exists.
                if (values[STR_ORDER[i + j]] > 0 && cardInHand(hand, STR_ORDER[i + j], suit)) {
                    continue;
                }
                if (wildsLeft === 0) {
                    failed = true;
                    break;
                }
                wildsLeft -= 1;
            }
            if (!failed) {
                return {result: true, value: STR_ORDER[i]}
            }
        }
    }
    return {result: false};
}

function cardInHand(hand, value, suit) {
    for (var card of hand) {
        if (card.value === value && card.suit === suit) {
            return true;
        }
    }
    return false;
}

function checkFullHouse(values, wildCount) {
    if (wildCount >= 2) {
        if (wildCount > 2) {
            console.log("ERROR: should not be calling checkFulLHouse with wildCount > 2!");
        }
        // If we have 3 or more wilds, we must have quads.
        // If we have 2 wilds but no quads, we must not have any pair, and cannot make a full house.
        return {result: false}
    }
    if (wildCount === 1) {
        // We must not have a trip, or we would have quads, find highest two pairs.
        var trip;
        for (var val of ORDER) {
            if (values[val] > 1) {
                if (trip) {
                    return {result: true, trip: trip, pair: val};
                } else {
                    trip = val;
                }
            }
        }
        return {result: false};
    }
    // No wilds, see if we can find a trip and a pair.
    var trip;
    for (var val in ORDER) {
        if (values[val] > 2) {
            trip = val;
            break;
        }
    }
    if (trip) {
        for (var val in ORDER) {
            if (val != trip && values[val] > 1) {
                return {result: true, trip: trip, pair: val};
            }
        }
    }
    return {result: false};
}

function lt(v1, v2) {
    if (v1 === v2) {
        return false;
    }
    for (var faceRank of ["A", "K", "Q", "J"]) {
        if (v1 === faceRank) {
            return false;
        }
        if (v2 === faceRank) {
            return true;
        }
    }
    return parseInt(v1) < parseInt(v2);
}