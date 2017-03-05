const express = require('express');
let router = express.Router();

router.get('/', function (req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === 'EAAZA429anqPYBAO6Mo4kVyWgTSxQM6HlxZC6lM1i0X98qrZCKdMPSopGjGAXpij6Ao9DiSXpx4rqhNzO2ZBOjqZCL3o1NDe6jorMDZCvR0NrZA1HFpxQjE9sxbZC1Qusf7OR4egYOZBcrEufnJeA4XvBCW1az38KOhR0qrp7TOcVbVQZDZD') {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

module.exports = router;