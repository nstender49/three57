const e = require("express");

var WIN = "win";
var TIE = "tie";
var LOSE = "lose";

module.exports.getWinner = function(players) {
    var winners = [];
    var best = undefined;
    for (var player of players) {
        var compare = compareResults(player.hand.hand, best);
        if (compare === WIN) {
            winners = [player.sessionId];
            best = player.hand.hand;
        } else if (compare === TIE) {
            winners.push(player.sessionId);
        }
    }
    return winners;
}

function compareResults(hand, best) {
    if (!best) {
        return WIN;
    }
    // Compare ranks
    if (HAND_RANKINGS[hand.rank] != HAND_RANKINGS[best.rank]) {
        return HAND_RANKINGS[hand.rank] < HAND_RANKINGS[best.rank] ? WIN : LOSE;
    }
    console.log("COMPARING HANDS " + hand + " " + best + " " + compareValues(hand, best));
    return compareValues(hand.values, best.values);
}

function compareValues(vals1, vals2) {
    if (!vals2) { return WIN; }
    // Compare value
    for (var i = 0; i < vals1.length; ++i) {
        if (vals1[i] != vals2[i]) {
            return lt(vals1[i], vals2[i]) ? LOSE : WIN;
        }
    }
    return TIE;
}

module.exports.handToString = function(hand) {
    switch(hand.rank) {
        case QAKAJ:
            return "QuAKAJack";
        case FIVE_OF_A_KIND:
            return "5-of-a-Kind " + hand.values[0] + "s";            
        case ROYAL_FLUSH:
            return "Royal Flush";
        case STRAIGHT_FLUSH:
            return hand.values[0] + " High Straight Flush";
        case FOUR_OF_A_KIND:
            return "4-of-a-Kind " + hand.values[0] + "s - Kicker: " + hand.values[1]; 
        case FULL_HOUSE:
            return "Full House " + hand.values[0] + "s over " + hand.values[1] + "s";
        case FLUSH:
            return "Flush " + hand.values.join("-");
        case STRAIGHT:
            return hand.values[0] + " High Straight";
        case THREE_OF_A_KIND:
            var s = "3-of-a-Kind " + hand.values[0] + "s";
            if (hand.values.length > 1) {
                s += " - Kickers: " + hand.values.slice(1).join("-");
            }
            return s;
        case TWO_PAIR:
            return "Two Pair " + hand.values[0] + "s over " + hand.values[1] + "s - Kicker: " + hand.values[2];
        case ONE_PAIR:
            var s = "Pair of " + hand.values[0] + "s";
            if (hand.values.length > 1) {
                s += " - Kickers: " + hand.values.slice(1).join("-");
            }
            return s;
        case HIGH_CARD:
            return "High Card: " + hand.values.join("-");
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

module.exports.getHandValue = function(hand, settings) { 
    var suits = {};
    var values = {};
    var wildCount = 0;
    var handSize = Math.min(hand.length, 5);

    // Count suits and values.
    for (var card of hand) {
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
        return {rank: QAKAJ}
    }

    // Get card with highest count and value.
    var countResult = getLargestSet(values);

    if (hand.length >= 5) {
        // FIVE_OF_A_KIND
        if (settings.five_of_a_kind && countResult.count + wildCount >= 5) {
            return {rank: FIVE_OF_A_KIND, values: [getHighCard(values, [], 5 - wildCount)]}
        }

        // ROYAL FLUSH / STRAIGHT FLUSH
        var flushResult = checkFlush(suits, wildCount, hand);
        var straightResult = checkStraight(values, wildCount);
        if (flushResult.result && straightResult.result) {
            var sfResult = checkStraightFlush(hand, values, suits, wildCount);
            if (sfResult.result) {
                if (sfResult.value === "A") {
                    return {rank: ROYAL_FLUSH}
                } else {
                    return {rank: STRAIGHT_FLUSH, values: [sfResult.value]}
                }
            }
        }

        // FOUR_OF_A_KIND
        if (countResult.count + wildCount >= 4) {
            var quad = getHighCard(values, [], 4 - wildCount)
            return {rank: FOUR_OF_A_KIND, values: [quad, getHighCard(values, [quad])]};
        }

        // FULL HOUSE
        if (countResult.count + wildCount >= 3) {
            fhResult = checkFullHouse(values, wildCount);
            if (fhResult.result) {
                return {rank: FULL_HOUSE, values: [fhResult.trip, fhResult.pair]};
            }
        }

        // FLUSH
        if (flushResult.result) {
            return {rank: FLUSH, values: flushResult.result};
        }

        // STRAIGHT
        if (straightResult.result) {
            return {rank: STRAIGHT, values: [straightResult.value]};
        }
    }

    // THREE_OF_A_KIND
    if (countResult.count + wildCount >= 3) {
        var trip = getHighCard(values, [], 3 - wildCount)
        return {rank: THREE_OF_A_KIND, values: [trip].concat(getKickers(values, handSize - 3, [trip]))};
    }

    // PAIRS
    if (countResult.count + wildCount >= 2) {
        // If we had two wilds, we'd have at least trips, so we must have max 1 wild.
        if (wildCount === 1) {
            // If we had a natural pair, we'd have trips, so best we can do is one pair.
            return {rank: ONE_PAIR, values: [countResult.value].concat(getKickers(values, handSize - 2, [countResult.value]))};
        }
        // See if we have a second natural pair.
        secondVal = getHighCard(values, [countResult.value], 2);
        if (secondVal) {
            return {rank: TWO_PAIR, values: [countResult.value, secondVal].concat(getKickers(values, handSize - 4, [countResult.value, secondVal]))};
        }
        // ONE_PAIR
        return {rank: ONE_PAIR, values: [countResult.value].concat(getKickers(values, handSize - 2, [countResult.value]))};
    }
    
    // HIGH CARD
    return {rank: HIGH_CARD, values: getKickers(values, handSize, [])};
}

function getKickers(values, numKickers, excludeValues) {
    var kickers = []
    while (kickers.length < numKickers) {
        var kicker = getHighCard(values, excludeValues);
        var toAdd = Math.min(values[kicker], numKickers - kickers.length);
        for (var i = 0; i < toAdd; i++) {
            kickers.push(kicker);
        }
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
    var best = undefined;
    for (var suit in suits) {
        if (suits[suit] + wildCount >= 5) {
            var values = getFlushCards(hand, suit, wildCount);
            if (compareValues(values, best) === WIN) {
                best = values;
            }
        }
    }
    return {result: best};
}


function getFlushCards(hand, suit, wildCount) {
    var values = [];
    for (var val of ORDER) {
        var found = false;
        for (var card of hand) {
            if (card.suit === suit && card.value === val) {
                values.push(card.value);
                found = true;
                break;
            }
        }
        if (!found && wildCount > 0) {
            values.push(val);
            wildCount--;
        }
        if (values.length === 5) {
            return values;
        }
    }
    return false;
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