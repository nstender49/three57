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
            expect(r).to.eql({rank: RANKS.FIVE_OF_A_KIND, values: ["K"]});
            // All wilds!
            var r = handComparison.getHandValue(convertStringHand("3D,5D,7D,3H,5S"), {five_of_a_kind: true, wilds: ["3", "5", "7"]});
            expect(r).to.eql({rank: RANKS.FIVE_OF_A_KIND, values: ["A"]});
            // Hand disabled.
            var r = handComparison.getHandValue(convertStringHand("KD,3D,3H,3C,3S,QS,QC"), {five_of_a_kind: false, wilds: ["3"]});
            expect(r.rank).to.equal(RANKS.ROYAL_FLUSH);
            // multiple wild values.
            var r = handComparison.getHandValue(convertStringHand("KD,3D,5H,7C,KH"), {five_of_a_kind: true, wilds: ["3", "5", "7"]});
            expect(r).to.eql({rank: RANKS.FIVE_OF_A_KIND, values: ["K"]});
            // multiple wild values.
            var r = handComparison.getHandValue(convertStringHand("5D,6D,6H,3C,5H"), {five_of_a_kind: true, wilds: ["2", "3", "4", "5"]});
            expect(r).to.eql({rank: RANKS.FIVE_OF_A_KIND, values: ["6"]});            
        });
        
        it("ROYAL_FLUSH", function() {
            for (var hand of ["AH,KH,QH,3D,10H", "AH,JH,QH,KH,10H"]) {
                var r = handComparison.getHandValue(convertStringHand(hand), {wilds: ["3"]});
                expect(r.rank).to.equal(RANKS.ROYAL_FLUSH);
            }
        });

        it("STRAIGHT_FLUSH", function() {
            var r = handComparison.getHandValue(convertStringHand("5H,4H,2H,3D,AH,6C"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.STRAIGHT_FLUSH, values: ["5"]});
            var r = handComparison.getHandValue(convertStringHand("KD,QD,7H,10D,9D"), {wilds: ["7"]});
            expect(r).to.eql({rank: RANKS.STRAIGHT_FLUSH, values: ["K"]});
        });
        
        it("FOUR_OF_A_KIND", function() {
            // Higher kicker
            var r = handComparison.getHandValue(convertStringHand("7H,7D,7S,7C,AH"), {wilds: ["5"]});
            expect(r).to.eql({rank: RANKS.FOUR_OF_A_KIND, values: ["7", "A"]});
            // Lower kicker, 7 cards
            var r = handComparison.getHandValue(convertStringHand("8H,8D,8S,8C,5H,4D,3C"), {wilds: ["7"]});
            expect(r).to.eql({rank: RANKS.FOUR_OF_A_KIND, values: ["8", "5"]});
            // Two potential 4 of a kinds with wilds, must pick higher one
            var r = handComparison.getHandValue(convertStringHand("8H,8D,8S,KC,KH,7D,7C"), {wilds: ["7"]});
            expect(r).to.eql({rank: RANKS.FOUR_OF_A_KIND, values: ["K", "8"]});
            // All wilds, 4 card hand
            var r = handComparison.getHandValue(convertStringHand("4D,3D,3H,2D"), {wilds: ["4", "2", "3"]});
            expect(r).to.eql({rank: RANKS.FOUR_OF_A_KIND, values: ["A"]});
            // 3 wilds, 4 card hand
            var r = handComparison.getHandValue(convertStringHand("4D,3D,3H,QD"), {wilds: ["4", "2", "3"]});
            expect(r).to.eql({rank: RANKS.FOUR_OF_A_KIND, values: ["Q"]});
            // Wild kicker
            var r = handComparison.getHandValue(convertStringHand("7D,7D,7S,7C,3D"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.FOUR_OF_A_KIND, values: ["7", "A"]});
        });
        
        it("FULL_HOUSE", function() {
            var r = handComparison.getHandValue(convertStringHand("2D,2H,6C,6D,3H"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.FULL_HOUSE, values: ["6", "2"]});
            var r = handComparison.getHandValue(convertStringHand("JH,8D,5C,5D,JC,2D,5S"), {wilds: ["7"]});
            expect(r).to.eql({rank: RANKS.FULL_HOUSE, values: ["5", "J"]});
        });

        it("FLUSH", function() {
            var r = handComparison.getHandValue(convertStringHand("5H,8H,KH,5D,QH,6H,7H"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.FLUSH, values: ["K", "Q", "8", "7", "6"]});
            var r = handComparison.getHandValue(convertStringHand("5H,3H,KH,5D,QH,6H,7H"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.FLUSH, values: ["A", "K", "Q", "7", "6"]});
            var r = handComparison.getHandValue(convertStringHand("AD,KD,QD,7H,9D"), {wilds: ["7"]});
            expect(r).to.eql({rank: RANKS.FLUSH, values: ["A", "K", "Q", "J", "9"]});
        });

        it("STRAIGHT", function() {
            var r = handComparison.getHandValue(convertStringHand("AH,KH,QH,3D,10C"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.STRAIGHT, values: ["A"]});
            var r = handComparison.getHandValue(convertStringHand("AC,KH,10S,9H,8D,3D,7S"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.STRAIGHT, values: ["J"]});
            var r = handComparison.getHandValue(convertStringHand("4C,3C,2H,AD,5S"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.STRAIGHT, values: ["5"]});
        });
        
        it("THREE_OF_A_KIND", function() {
            // All wilds three card hand
            var r = handComparison.getHandValue(convertStringHand("3D,3H,2D"), {wilds: ["2", "3"]});
            expect(r).to.eql({rank: RANKS.THREE_OF_A_KIND, values: ["A"]});
            // 3's not wild
            var r = handComparison.getHandValue(convertStringHand("3D,3H,3S"), {wilds: ["5"]});
            expect(r).to.eql({rank: RANKS.THREE_OF_A_KIND, values: ["3"]});
            // With kickers
            var r = handComparison.getHandValue(convertStringHand("3D,8D,3H,5H,3S"), {wilds: ["7"]});
            expect(r).to.eql({rank: RANKS.THREE_OF_A_KIND, values: ["3", "8", "5"]});
            // Kick out some kickers
            var r = handComparison.getHandValue(convertStringHand("3D,8D,3H,5H,3S,AH,2D"), {wilds: ["7"]});
            expect(r).to.eql({rank: RANKS.THREE_OF_A_KIND, values: ["3", "A", "8"]});
        });
        
        it("TWO_PAIR", function() {
            // Natural
            var r = handComparison.getHandValue(convertStringHand("7H,4C,4S,7S,2D"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.TWO_PAIR, values: ["7", "4", "2"]});
            // Kick out some kickers
            var r = handComparison.getHandValue(convertStringHand("7H,4C,4S,7S,2D,AS,JD"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.TWO_PAIR, values: ["7", "4", "A"]});
        });
        
        it("ONE_PAIR", function() {
            // Natural
            var r = handComparison.getHandValue(convertStringHand("7H,4C,5S,7S,2D"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.ONE_PAIR, values: ["7", "5", "4", "2"]});
            // With wild
            var r = handComparison.getHandValue(convertStringHand("7H,4C,5S,3S,2D"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.ONE_PAIR, values: ["7", "5", "4", "2"]});
            // Three cards
            var r = handComparison.getHandValue(convertStringHand("7H,KC,7S"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.ONE_PAIR, values: ["7", "K"]});
            // All wilds two card hand
            var r = handComparison.getHandValue(convertStringHand("2D,2H"), {wilds: ["2"]});
            expect(r).to.eql({rank: RANKS.ONE_PAIR, values: ["A"]});
        });
        
        it("HIGH_CARD", function() {
            var r = handComparison.getHandValue(convertStringHand("7H,4C,5S,KS,2D"), {wilds: ["3"]});
            expect(r).to.eql({rank: RANKS.HIGH_CARD, values: ["K", "7", "5", "4", "2"]});
        });
        
    });
});