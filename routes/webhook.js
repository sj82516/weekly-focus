const express = require('express');
let router = express.Router();
let request = require('request');

const ArticleModel = require('../model/article.model').ArticleModel;
const IssueModel = require('../model/issue.model').IssueModel;

const PAGE_ACCESS_TOKEN = "EAAZA429anqPYBAAbT2B0EkZCCXMHoVUoUcBqDiZC5gFjU4bCCg21pcT5YjzQyV7dNM3lSzl5yDFaXQBQ0D2sM0AfC1x2OZCACLnFS0jnwhGpM2LOQ7CUgNDcwCWZADGQNpAWagRI1ee4ZAa2UFzm2PHUG1dIZCcSg9WFLOD3PZCLRAZDZD";
const WEB_URL = "https://yuanchieh.info";

// FB的Webhook GET 驗證
router.get('/', function (req, res) {

    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === PAGE_ACCESS_TOKEN) {
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
                console.log(event, event.postback);
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

    let messageId = message.mid;

    let messageText = message.text;
    let messageAttachments = message.attachments;

    if (messageText) {
        //去除所有空白
        messageText = messageText.replace(/ /g, '');
        console.log('search test', /^search:/.test(messageText));

        //依照不同的訊息做不同回應
        if(messageText === 'feed'){
            sendFeedMessage(senderID);
        }else if(/^search:/.test(messageText)){
            let searchString = /search:([a-zA-Z0-9]*)/.exec(messageText)?/search:([a-zA-Z0-9]*)/.exec(messageText)[1]:"";
            sendSearchMessage(searchString || '', senderID);
        }else{
            sendTextMessage(senderID, messageText);
        }

    } else if (messageAttachments) {
        sendTextMessage(senderID, "Message with attachment received");
    }
}

function sendTextMessage(recipientId, text) {
    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text || "Message not supported. Please type in 'feed' for random articles or 'search:${text}' to search topic"
        }
    };

    callSendAPI(messageData);
}

function sendFeedMessage(recipientId) {
    ArticleModel.aggregate([{$sample: {size: 5}}]).exec().then(articleList => {
        "use strict";
        if(articleList === null || articleList.length === 0){
            return sendTextMessage(recipientId, "nothing found");
        }
        let messageData = {
            recipient: {
                id: recipientId
            },
            message: articleListToMessage(articleList)
        };
        callSendAPI(messageData);
    }).catch(err => {
        "use strict";
        console.error("sendFeedMessage", err);
    });
}

function sendSearchMessage(searchString, recipientId) {
    "use strict";
    ArticleModel.find({$text: {$search: searchString}}).limit(5).exec().then(articleList=> {
        if(articleList === null || articleList.length === 0){
            return sendTextMessage(recipientId, "nothing found");
        }
        let messageData = {
            recipient: {
                id: recipientId
            },
            message: articleListToMessage(articleList)
        };
        callSendAPI(messageData);
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

    console.log("Received postback for user", payload);

    let regex = /^ISSUE:([0-9]*)/.exec(payload);
    let issueId = regex[1] || process.env.LatestIssue;
    console.log(issueId);

    ArticleModel.find({issueId: issueId}).limit(5).exec().then(articleList=> {
        if(articleList === null || articleList.length === 0){
            return sendTextMessage(recipientId, "nothing found");
        }
        let messageData = {
            recipient: {
                id: senderID
            },
            message: articleListToMessage(articleList)
        };
        callSendAPI(messageData);
    }).catch(err => {
        "use strict";
        console.error("sendSearchMessage", err);
    });
}

function callSendAPI(messageData) {
    console.log('callsendapi', messageData);
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
            console.error("callSendAPI",error);
        }
    });
}

// 將文章轉為訊息
function articleListToMessage(articleList) {
    "use strict";
    let articleMsgList = articleList.map(article => {
        return {
            title: article.title,
            subtitle: article.author,
            image_url: WEB_URL + '/images/weeklyfocus.jpeg',
            buttons: [{
                type: "web_url",
                url: article.link,
                title: "Link to article"
            }, {
                type: "postback",
                payload: 'ISSUE:' + article.issueId,
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
