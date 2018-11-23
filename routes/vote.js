const express = require('express');
const polytope      = require('../algorithm/polytope');
const socialChoice  = require('../algorithm/socialChoice');
const socialWelfare = require('../algorithm/socialWelfare');
const randomAssignment = require('../algorithm/randomAssignment');

const router = express.Router();

router.post("",(req,res,next) => {
    // console.log("Incoming",req.body);

    let response = {
        success: false,
        msg: "An unknown error has occured."
    }

    switch (req.body.algorithm.toLowerCase()) {
        // Social Decision Schemes
        case "c2-maximal lottery":
            response = polytope.maxLottery(req.body);
            break;

        case "maximal lottery":
            response = polytope.homogeneousMaximalLottery(req.body);
            break;

        case "random dictatorship":
            response = polytope.randomDictatorship(req.body);
            break;

        case "proportional borda":
            response = polytope.proportionalBorda(req.body);
            break;

        case "pluri-borda":
            response = polytope.pluriBorda(req.body);
            break;

        // Social Choice Functions

        case "essential set":
            response = polytope.essentialSet(req.body);
            break;

        case "bipartisan set":
            response = polytope.bipartisanSet(req.body);
            break;

        case "plurality":
            response = socialChoice.plurality(req.body);
            break;

        case "plurality with runoff":
            response = socialChoice.pluralityWithRunoff(req.body);
            break;

        case "instant runoff":
            response = socialChoice.instantRunoff(req.body);
            break;

        case "anti-plurality":
            response = socialChoice.antiPlurality(req.body);
            break;

        case "bucklin":
            response = socialChoice.bucklin(req.body);
            break;

        case "coombs":
            response = socialChoice.coombs(req.body);
            break;

        case "borda":
            response = socialChoice.borda(req.body);
            break;

        case "maximin":
            response = socialChoice.maximin(req.body);
            break;

        case "nanson":
            response = socialChoice.nanson(req.body);
            break;

        case "baldwin":
            response = socialChoice.baldwin(req.body);
            break;

        case "black":
            response = socialChoice.black(req.body);
            break;

        case "tideman":
            response = socialChoice.tideman(req.body);
            break;

        case "condorcet":
        case "weak condorcet":
        case "majority winner":
            response = socialChoice.condorcet(req.body);
            break;

        case "pareto":
            response = socialChoice.pareto(req.body);
            break;

        case "mixed efficient":
            response = socialChoice.mixedDominance(req.body);
            break;

        case "copeland":
            response = socialChoice.copeland(req.body);
            break;

        // case "top cycle":
        //     response = socialChoice.topCycle(req.body);
        //     break;

        case "uncovered set":
            response = socialChoice.uncoveredSet(req.body);
            break;

        // Social Welfare Functions

        // case "kemeny":
        //     response = socialWelfare.kemeny(req.body);
        //     break;

        case "kemeny ranking":
            response = socialWelfare.kemenyILP(req.body);
            break;

        case "kemeny":
            response = socialWelfare.kemenyWinnersILP(req.body);
            break;

        case "schulze":
            response = socialWelfare.schulze(req.body);
            break;

        case "ranked pairs":
            response = socialChoice.allRankedPairsWinnersWithTrivialTieBreaking(req.body);
            break;

        case "ranked pairs ranking":
            response = socialWelfare.rankedPairs(req.body);
            break;

        // Random Assignment

        case "random serial dictatorship":
            response = randomAssignment.rsd(req.body);
            break;

        case "probabilistic serial rule":
            response = randomAssignment.ps(req.body);
            break;

        case "popular random assignment":
            response = randomAssignment.pra(req.body);
            break;

        default:
            response = {
                success: false,
                msg:"Unknown algorithm "+req.body.algorithm+"."
            }
    }

    // console.log("Send Answer",response);
    res.send(response);
});


module.exports = router;
