var handComparison = require("../libs/hand_comparison");
var RANKS = handComparison.RANKS;
var expect = require("chai").expect;

function convertStringHand(h) {
    hand = [];
    for (var card of h.split(",")) {
        hand.push({value: card.slice(0, card.length - 1), suit: card.slice(card.length - 1)});
    }
    return hand;
}

SETTINGS = {wilds: ["3"]};

describe("Test hand comparison", function() {
    describe("Test get hand value", function() {
        it("QAKAJ", function() {
            var r = handComparison.getHandValue(convertStringHand("AH,AD,QS,KS,JD"), {qakaj: true, wilds: []})
            expect(r.rank).to.equal(RANKS.QAKAJ);
            // Wilds are not allowed.
            var r = handComparison.getHandValue(convertStringHand("AH,AD,3D,KS,JD"), {qakaj: true, wilds: ["3"]})
            expect(r.rank).to.equal(RANKS.THREE_OF_A_KIND);
            // Hand disabled.
            var r = handComparison.getHandValue(convertStringHand("AH,AD,QS,KS,JD"), {qakaj: false, wilds: []})
            expect(r.rank).to.equal(RANKS.ONE_PAIR);
        });

        it("FIVE_OF_A_KIND", function() {
            var r = handComparison.getHandValue(convertStringHand("KD,3D,3H,3C,3S,QS,QC"), {five_of_a_kind: true, wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.FIVE_OF_A_KIND);
            expect(r.values).to.eql(["K"]);
            // All wilds!
            var r = handComparison.getHandValue(convertStringHand("3D,5D,7D,3H,5S"), {five_of_a_kind: true, wilds: ["3", "5", "7"]});
            expect(r.rank).to.equal(RANKS.FIVE_OF_A_KIND);
            expect(r.values).to.eql(["A"]);
            // Hand disabled.
            var r = handComparison.getHandValue(convertStringHand("KD,3D,3H,3C,3S,QS,QC"), {five_of_a_kind: false, wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.ROYAL_FLUSH);
            // multiple wild values.
            var r = handComparison.getHandValue(convertStringHand("KD,3D,5H,7C,KH"), {five_of_a_kind: true, wilds: ["3", "5", "7"]});
            expect(r.rank).to.equal(RANKS.FIVE_OF_A_KIND);
            expect(r.values).to.eql(["K"]);
        });

        it("ROYAL_FLUSH", function() {
            for (var hand of ["AH,KH,QH,3D,10H", "AH,JH,QH,KH,10H"]) {
                var r = handComparison.getHandValue(convertStringHand(hand), {wilds: ["3"]});
                expect(r.rank).to.equal(RANKS.ROYAL_FLUSH);
            }
        });

        it("STRAIGHT_FLUSH", function() {
            for (var hand of ["5H,4H,2H,3D,AH,6C"]) {
                var r = handComparison.getHandValue(convertStringHand(hand), {wilds: ["3"]});
                expect(r.rank).to.equal(RANKS.STRAIGHT_FLUSH);
                expect(r.values).to.eql(["5"]);
            }
        });

        it("FOUR_OF_A_KIND", function() {
            for (var hand of ["7H,7D,7S,7C,AH"]) {
                var r = handComparison.getHandValue(convertStringHand(hand), {wilds: ["3"]});
                expect(r.rank).to.equal(RANKS.FOUR_OF_A_KIND);
                expect(r.values).to.eql(["7", "A"]);
            }
        });

        it("FULL_HOUSE", function() {
            var r = handComparison.getHandValue(convertStringHand("2D,2H,6C,6D,3H"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.FULL_HOUSE);
            expect(r.values).to.eql(["6", "2"]);
            var r = handComparison.getHandValue(convertStringHand("JH,8D,5C,5D,JC,2D,5S"), {wilds: ["7"]});
            expect(r.rank).to.equal(RANKS.FULL_HOUSE);
            expect(r.values).to.eql(["5", "J"]);
        });

        it("FLUSH", function() {
            var r = handComparison.getHandValue(convertStringHand("5H,8H,KH,5D,QH,6H,7H"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.FLUSH);
            expect(r.values).to.eql(["K", "Q", "8", "7", "6"]);
            var r = handComparison.getHandValue(convertStringHand("5H,3H,KH,5D,QH,6H,7H"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.FLUSH);
            expect(r.values).to.eql(["A", "K", "Q", "7", "6"]);
        });

        it("STRAIGHT", function() {
            var r = handComparison.getHandValue(convertStringHand("AH,KH,QH,3D,10C"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.STRAIGHT);
            expect(r.values).to.eql(["A"]);
            var r = handComparison.getHandValue(convertStringHand("AC,KH,10S,9H,8D,3D,7S"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.STRAIGHT);
            expect(r.values).to.eql(["J"]);
            var r = handComparison.getHandValue(convertStringHand("4C,3C,2H,AD,5S"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.STRAIGHT);
            expect(r.values).to.eql(["5"]);
        });

        it("THREE_OF_A_KIND", function() {
            // 3'd wild
            var r = handComparison.getHandValue(convertStringHand("3D,3H,3S"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.THREE_OF_A_KIND);
            expect(r.values).to.eql(["A"]);
            // 3's not wild
            var r = handComparison.getHandValue(convertStringHand("3D,3H,3S"), {wilds: ["5"]});
            expect(r.rank).to.equal(RANKS.THREE_OF_A_KIND);
            expect(r.values).to.eql(["3"]);
            // With kickers
            var r = handComparison.getHandValue(convertStringHand("3D,8D,3H,5H,3S"), {wilds: ["7"]});
            expect(r.rank).to.equal(RANKS.THREE_OF_A_KIND);
            expect(r.values).to.eql(["3", "8", "5"]);
            // Kick out some kickers
            var r = handComparison.getHandValue(convertStringHand("3D,8D,3H,5H,3S,AH,2D"), {wilds: ["7"]});
            expect(r.rank).to.equal(RANKS.THREE_OF_A_KIND);
            expect(r.values).to.eql(["3", "A", "8"]);
        });

        it("TWO_PAIR", function() {
            // Natural
            var r = handComparison.getHandValue(convertStringHand("7H,4C,4S,7S,2D"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.TWO_PAIR);
            expect(r.values).to.eql(["7", "4", "2"]);
            // Kick out some kickers
            var r = handComparison.getHandValue(convertStringHand("7H,4C,4S,7S,2D,AS,JD"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.TWO_PAIR);
            expect(r.values).to.eql(["7", "4", "A"]);
        });

        it("ONE_PAIR", function() {
            // Natural
            var r = handComparison.getHandValue(convertStringHand("7H,4C,5S,7S,2D"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.ONE_PAIR);
            expect(r.values).to.eql(["7", "5", "4", "2"]);
            // With wild
            var r = handComparison.getHandValue(convertStringHand("7H,4C,5S,3S,2D"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.ONE_PAIR);
            expect(r.values).to.eql(["7", "5", "4", "2"]);
            // Three cards
            var r = handComparison.getHandValue(convertStringHand("7H,KC,7S"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.ONE_PAIR);
            expect(r.values).to.eql(["7", "K"]);
        });

        it("HIGH_CARD", function() {
            var r = handComparison.getHandValue(convertStringHand("7H,4C,5S,KS,2D"), {wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.HIGH_CARD);
            expect(r.values).to.eql(["K", "7", "5", "4", "2"]);
        });
    });
});