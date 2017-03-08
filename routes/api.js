const express = require('express');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const request = require('request');

const ArticleModel = require('../model/article.model').ArticleModel;
const IssueModel = require('../model/issue.model').IssueModel;
const SubscriberModel = require('../model/subscriber.model').SubscriberModel;
const jwt = require('jsonwebtoken');

const csurf = require('csurf');
let csrfProtection = csurf({cookie: false});

const nodemailer = require('nodemailer');

// transporter固定不變
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'weeklyfocus123@gmail.com',
        pass: 'QWERASDF'
    }
});

let subscribeEmail = '';
fs.readFile(path.join(__dirname, '../views', 'subscribeEmail.html'), 'utf8', function (err, data) {
    "use strict";
    if (err)console.error('read file error', err);
    subscribeEmail = data;
});
// Mail設定會更動
class subscribeMailOptions {
    constructor(to) {
        let token = jwt.sign({
            email: to
        }, process.env.JWT_TOKEN || 'secret', {expiresIn: '1h'});

        this.from = '"Weekly Focus" <weeklyfocus123@gmail.com>'; // sender address
        this.to = to || ''; // list of receivers,用逗號隔開
        this.subject = 'Weekly Focus: Please Confirm Subscription'; // Subject line
        this.html = subscribeEmail.replace('${token}', token);
    }
}

let unsubscribeEmail = '';
fs.readFile(path.join(__dirname, '../views', 'unsubscribeEmail.html'), 'utf8', function (err, data) {
    "use strict";
    if (err)console.error('read file error', err);
    unsubscribeEmail = data;
});
class unsubscribeMailOptions {
    constructor(to) {
        let token = jwt.sign({
            email: to
        }, process.env.JWT_TOKEN || 'secret', {expiresIn: '1h'});

        this.from = '"Weekly Focus" <weeklyfocus123@gmail.com>'; // sender address
        this.to = to || ''; // list of receivers,用逗號隔開
        this.subject = 'Weekly Focus: Please Confirm Subscription'; // Subject line
        this.html = unsubscribeEmail.replace('${token}', token);
    }
}

const emailRegex = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

// 關注, client 發送Email和csrf token，如果沒有csrf token或是出錯，會到/app.js的錯誤處理區
router.post('/subscribe', csrfProtection, function (req, res, next) {
    "use strict";
    let subscriberEmail = req.body.email;
    // 先判斷Email格式正確與否
    if (subscriberEmail && emailRegex.test(subscriberEmail)) {

        // 接著從SubscriberModel找出是否已存在Email
        SubscriberModel.findOne({email: subscriberEmail}).exec().then((subscriber)=> {

            //如果Email已經confirm，回傳失敗訊息
            if (subscriber && subscriber.status === 'confirmed') {
                return res.redirect('/?error=email-exist');
            } else {
                //發送驗證信
                //使用創建或更新
                return SubscriberModel.update({
                    email: subscriberEmail,
                    status: 'unconfirm'
                }, {email: subscriberEmail}, {upsert: true, setDefaultsOnInsert: true}).exec()
            }
        }).then(()=> {
            transporter.sendMail(new subscribeMailOptions(subscriberEmail), (err, info) => {
                if (err) {
                    console.log('/api/subscribe sendmail error', err);
                    return res.redirect('/?error=server');
                }
                return res.redirect('/thankyou?success=subscribe');
            });
        }).catch(err => {
            console.log('/api/subscribe db error', err);
            return res.redirect('/?error=server');
        });
    } else {
        return res.redirect('/?error=email');
    }
});

// 關注驗證確認
router.get('/confirm-subscribe', function (req, res, next) {
    "use strict";
    let token = req.query.token;
    if (!token) {
        return next("MissingToken");
    }
    try {
        let decoded = jwt.verify(token, process.env.JWT_TOKEN || 'secret');
        let decodedEmail = decoded.email;
        SubscriberModel.findOne({email: decodedEmail}).exec().then(subscriber=> {
            if (subscriber) {
                subscriber.status = 'confirmed';
                subscriber.save(function (err) {
                    if (err) {
                        return res.redirect('/?error=email');
                    }
                    // 返回驗證成功頁面
                    return res.redirect('/?success=subscribe')
                });
            }
        })
    } catch (err) {
        // 驗證錯誤，回復錯誤並請使用者重新註冊
        return res.redirect('/?error=token');
    }
});

// 取消關注
router.post('/unsubscribe', csrfProtection, function (req, res) {
    "use strict";
    let unsubscriberEmail = req.body.email;

    // 欄位資料缺乏
    if (!unsubscriberEmail || !emailRegex.test(unsubscriberEmail) || req.body['g-recaptcha-response'] == '') {
        return res.redirect('/unsubscribe?error=miss-param');
    }

    request.post({
        url: 'https://www.google.com/recaptcha/api/siteverify', form: {
            secret: '6Lf0XxYUAAAAAPey6PSVLRTJtT8rAKF90y9DcCRe',
            response: req.body['g-recaptcha-response']
        }
    }, function (err, response, body) {
        if (!err && response.statusCode == 200) {
            let info = JSON.parse(body);
            if (info.success) {
                // 確認不是機器人後，比對Email是否存在，如果不存在返回錯誤
                // 反之寄出unsubscribe驗證信
                SubscriberModel.findOne({email: unsubscriberEmail}).exec().then(subscriber => {
                    if (!subscriber) {
                        return res.redirect('/unsubscribe?error=email-not-exist');
                    }
                    transporter.sendMail(new unsubscribeMailOptions(unsubscriberEmail), (err, info) => {
                        if (err) {
                            console.log('/api/unsubscribe sendmail error', err);
                            return res.redirect('/?error=server');
                        }
                        return res.redirect('/thankyou?success=unsubscribe');
                    });
                }).catch(err => {
                    console.log(err);
                    return res.redirect('/unsubscribe?error=server');
                })

            } else {
                return res.redirect('/unsubscribe?error=robot');
            }
        } else {
            return res.redirect('/unsubscribe?error=request');
        }
    });
});

// 取消關注驗證確認
router.get('/confirm-unsubscribe', function (req, res) {
    "use strict";
    let token = req.query.token;
    if (!token) {
        return next("MissingToken");
    }
    try {
        let decoded = jwt.verify(token, process.env.JWT_TOKEN || 'secret');
        let decodedEmail = decoded.email;
        SubscriberModel.findOneAndRemove({email: decodedEmail}, function(err){
            if (err) {
                return res.redirect('/?error=email');
            }
            // 返回驗證成功頁面
            return res.redirect('/?success=unsubscribe')
        })
    } catch (err) {
        // 驗證錯誤，回復錯誤並請使用者重新註冊
        return res.redirect('/?error=token');
    }
});

module.exports = router;
