const express = require('express');
let router = express.Router();
let request = require('request');

const ArticleModel = require('../model/article.model').ArticleModel;
const IssueModel = require('../model/issue.model').IssueModel;

const PAGE_ACCESS_TOKEN = "";
const WEB_URL = "https://yuanchieh.info"

// FB的Webhook GET 驗證
router.get('/', function (req, res) {

    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === 'EAAZA429anqPYBAGH9ZBQ1rZCv8lBHVOboRrYm2NInjGV9wznYwix5ZC01Axg3nR536HS3K8KS1UYgrZAvKZA5J0ZCAk6vLy5MANQbb6ZCRrhsjSLI71lIrZBdyipEVzMm0yaQuyBGLFNBZCB2Pa9vZCOL95AdMO5AtOKl7Gm93IIZBxNKgZDZD') {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

// 有任何人發送訊息或動作，Webhook自動發送POST，之後解析event的型態
router.post('/', function (req, res) {
    let data = req.body;

    // Make sure this is a page subscription
    if (data.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        data.entry.forEach(function (entry) {
            let pageID = entry.id;
            let timeOfEvent = entry.time;

            // Iterate over each messaging event
            entry.messaging.forEach(function (event) {
                if (event.message) {
                    receivedMessage(event);
                } else if (event.postback) {
                    receivedPostback(event);
                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know
        // you've successfully received the callback. Otherwise, the request
        // will time out and we will keep trying to resend.
        res.sendStatus(200);
    }
});

function receivedMessage(event) {
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let timeOfMessage = event.timestamp;
    let message = event.message;

    console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    let messageId = message.mid;

    let messageText = message.text;
    let messageAttachments = message.attachments;

    if (messageText) {
        //去除所有空白
        let messageText = messageText.replace(/ /g, '');

        // If we receive a text message, check to see if it matches a keyword
        // and send back the example. Otherwise, just echo the text we received.
        switch (messageText) {
            case 'feed':
                sendFeedMessage(senderID);
                break;
            case /search:/.match(messageText):
                let searchString = /search:([a-zA-Z0-9]*)/.exec(messageText)[1];
                console.log("match search", searchString);
                sendSearchMessage(searchString || '');
                break;
            default:
                sendTextMessage(senderID, messageText);
        }
    } else if (messageAttachments) {
        sendTextMessage(senderID, "Message with attachment received");
    }
}

function sendTextMessage(recipientId, messageText) {
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };

    callSendAPI(messageData);
}

function sendFeedMessage(recipientId) {
    ArticleModel.aggregate([{$sample: {size: 5}}]).exec().then(articleList => {
        "use strict";
        console.log("sendFeedMessage:"+articleList);

        callSendAPI(articleListToMessage(articleList));
    }).catch(err => {
        "use strict";
        console.error("sendFeedMessage", err);
    });
}

function sendSearchMessage(searchString) {
    "use strict";
    ArticleModel.find({$text: {$search: searchString}}).limit(5).exec().then(articleList=>{
        callSendAPI(articleListToMessage(articleList));
    }).catch(err => {
        "use strict";
        console.error("sendSearchMessage", err);
    });
}

function receivedPostback(event) {
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let timeOfPostback = event.timestamp;

    // The 'payload' param is a developer-defined field which is set in a postback
    // button for Structured Messages.
    let payload = event.postback.payload;

    console.log("Received postback for user %d and page %d with payload '%s' " +
        "at %d", senderID, recipientID, payload, timeOfPostback);

    // When a postback is called, we'll send a message back to the sender to
    // let them know it was successful
    sendTextMessage(senderID, "Postback called");
}

function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            let recipientId = body.recipient_id;
            let messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s",
                messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.error(error);
        }
    });
}

// 將文章轉為訊息
function articleListToMessage(articleList){
    "use strict";
    let articleMsgList = articleList.map(article => {
        return {
            title: article.title,
            subtitle: article.author,
            item_url: article.link,
            image_url: "",
            buttons: [{
                type: "web_url",
                url: article.link,
                title: "Link to article"
            }, {
                type: "postback",
                payload: 'ISSUE:' + issueId,
                title: "Show more article in this Issue"
            }]
        }
    });
    return {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                elements: articleMsgList,
            }
        }
    };
}

module.exports = router;