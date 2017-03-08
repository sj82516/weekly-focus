let router = require('express').Router();
let CronJob = require('cron').CronJob;
const path = require('path');
const jade = require('jade');
const request = require('request');
const nodemailer = require('nodemailer');

const csurf = require('csurf');
let csrfProtection = csurf({cookie: false});

const ArticleModel = require('../model/article.model').ArticleModel;
const IssueModel = require('../model/issue.model').IssueModel;
const SubscriberModel = require('../model/subscriber.model').SubscriberModel;

// 預防系統掛掉，重啟時先找出目前最新的Issue其數
// LatestIssue表示 目前公開的最新一期
function init() {
    "use strict";
    process.env.Cronday = process.env.Cronday || 'Thursday';
    IssueModel.find({}).sort({id: -1}).exec().then(docs => {
        "use strict";
        process.env.LatestIssue = docs[0] ? parseInt(docs[0].id) - 1 : 0;
        if (!docs[0]) {
            return IssueModel.create({
                id: 1,
            })
        }
    }).then().catch(err => {
        console.log(err);
    });
}
init();

let week = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
let cronWeekday = week.indexOf(process.env.Cronday) || 3;

//設定cron job定期
// 秒 分 時 日 月 星期X
// 預設星期X的23:59:59開始發送Issue
// let job = new CronJob('59 59 23 * * ' + cronWeekday, weeklyTask, null, true, 'America/Los_Angeles');
let job = new CronJob('0 59 23 * * ' + cronWeekday, weeklyTask, null, true, 'Asia/Taipei');
job.start();

// 固定事件，更新最新一期的Issue
// Issue期數從1開始
function weeklyTask() {
    "use strict";
    console.log('You will see this message every ' + process.env.Cronday);
    // 目前可發售最新一期
    process.env.LatestIssue = parseInt(process.env.LatestIssue) + 1;

    createIssue();
    renderIssueEmail();

    weeklyFacebookPost();
}

//找出目前最新一期的Issue，並新增一期
function createIssue() {
    "use strict";
    IssueModel.find({}).sort({id: -1}).exec().then(docs => {
        "use strict";
        let issue = new IssueModel({
            id: parseInt(process.env.LatestIssue) + 1,
        });
        issue.save(function (err) {
            // we've saved the dog into the db here
            if (err) throw err;
        });
    }).catch(err => {
        "use strict";
        console.log('weeklyTask error', err);
    });
}

// 喧染IssueEmail並發送郵件
function renderIssueEmail() {
    "use strict";
    let issueEmailHTML = '';
    ArticleModel.find({issueId: process.env.LatestIssue}).exec().then(articleList => {
        issueEmailHTML = jade.renderFile(path.join(__dirname, '../views/issueEmail.jade'), {
            issueId: process.env.LatestIssue,
            date: monthNames[new Date().getMonth()] + ' ' + new Date().getDate() + ', ' + new Date().getFullYear(),
            articleList
        });
        return SubscriberModel.find({status: 'confirmed'}).exec();
    }).then(subscriberList => {
        console.log('list to send email:', subscriberList.map(subscriber => subscriber.email));
        deliverIssueEmail(subscriberList.map(subscriber => subscriber.email), issueEmailHTML);
    }).catch(err => {
        console.error('renderIssueEmail', err);
    });
}

// transporter固定不變
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'weeklyfocus123@gmail.com',
        pass: 'QWERASDF'
    }
});
// Mail設定會更動
class issueMailOptions {
    constructor(to, email) {
        this.from = '"Weekly Focus" <weeklyfocus123@gmail.com>'; // sender address
        this.to = to || ''; // list of receivers,用逗號隔開
        this.subject = 'The weekly focus news' + ', issue' + process.env.LatestIssue; // Subject line
        this.html = email;
    }
}

//發送郵件，為了避免當作垃圾郵件，每次取80封寄送
//間隔100ms發送直到全部發完
function deliverIssueEmail(emailList, issueEmailHTML) {
    "use strict";
    if (emailList.length == 0) {
        return;
    }
    let emailTo = emailList.length < 80 ? emailList.splice(0, 80).join(',') : emailList.splice(0, emailList.length).join(',');
    console.log(emailTo);
    transporter.sendMail(new issueMailOptions(emailTo, issueEmailHTML), (err, info) => {
        if (err) {
            console.error('deliverIssueEmail sendmail error', err);
        }
        if (emailList.length > 0) {
            return setTimeout(deliverIssueEmail(emailList, issueEmailHTML), 100);
        }
    });
}

router.get('/', csrfProtection, function (req, res, next) {
    ArticleModel.find({issueId: parseInt(process.env.LatestIssue) + 1}).exec().then(articleList => {
        "use strict";
        res.render('admin', {
            nextIssue: parseInt(process.env.LatestIssue) + 1,
            cronday: process.env.Cronday,
            csrfToken: req.csrfToken(),
            csrfTokenCronDay: req.csrfToken(),
            articleList: articleList
        })
    })
});

router.get('/preview', function (req, res) {
    "use strict";
    ArticleModel.find({issueId: parseInt(process.env.LatestIssue) + 1}).exec().then(articleList => {
        let date = new Date();
        date.setDate(date.getDate() + ( week.indexOf(process.env.Cronday) + 7 - date.getDay()) % 7);
        res.render('preview', {
            issueId: parseInt(process.env.LatestIssue) + 1,
            articleList,
            date: handleDateFormat(date)
        });
    })
});

// 文章
router.route('/article', csrfProtection)
    .post(function (req, res) {
        "use strict";
        ArticleModel.create({
            title: req.body.title,
            intro: req.body.intro,
            author: req.body.author,
            link: req.body.link,
            issueId: parseInt(process.env.LatestIssue) + 1
        }).then(article => {
            console.log(article);
            res.json({article})
        }).catch(err => {
            console.log(err);
            res.json({err});
        })
    })
    .put(function (req, res) {
        ArticleModel.findOneAndUpdate({_id: req.body.articleId}, {
            title: req.body.title,
            intro: req.body.intro,
            author: req.body.author,
            link: req.body.link,
        }, {new: true}, function (err, article) {
            if (err) return res.json({err});
            console.log(article);
            res.json({article});
        })
    }).delete(function (req, res) {
    console.log('remove', req.body);
    ArticleModel.findOneAndRemove({_id: req.body.articleId}, function (err) {
        if (err) return res.json({err});
        res.json({success: true});
    })
});

router.post('/cronday', csrfProtection, function (req, res) {
    "use strict";
    process.env.Cronday = req.body.cronday || 'Thursday';
    // cronday修正後應該要重新啟動，但是demo需求就先固定每10分鐘一封
    // job.stop();
    // job = new CronJob('0 */10 * * * *', weeklyTask, null, true, 'Asia/Taipei');
    // job.start();
    res.redirect('/admin');
});

// 處理日期格式，回傳字串
function handleDateFormat(date) {
    "use strict";
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return monthNames[new Date(date).getMonth()] + ' ' + new Date(date).getDate() + ', ' + new Date(date).getFullYear();
}


const FB_APP_ID = '1821735454746870';
const FB_APP_SECRET = '2d1dffbe2e884a15d55c5e2ec70503c1';
let fbShortenToken = 'EAAZA429anqPYBAASW50VOwDPxz5qux7sBmis0iBRBzbixmZBTqpvY2s6fdVz3D2WyfB544BEjZAxHWYZB7fhVZC3VWKUaVVTVph20M1nHFYw1nFE9Bfl4mQS4ZA08eFoAzZCl2E0B3cfZBTluv2b4u6ZAYIN14q3vcmXdfvVcjomZACot20zyC4ZBNWeq5EbNZA98LAZD';

function weeklyFacebookPost() {
    "use strict";
    let extend_token_url = `https://graph.facebook.com/v2.8/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&amp&client_secret=${FB_APP_SECRET}&amp&fb_exchange_token=${fbShortenToken}`

    //定期更新Token
    request(extend_token_url, function(err, response, body){
        let access_token = JSON.parse(body).access_token;

        // 因為Token只少每60天都必須延長一次，所以改成每週發文時都將上禮拜的Token換成這裡的新Token
        fbShortenToken = access_token;

        // 拿 應用程式的粉絲專頁Token 換成 有Po文權限的Token
        request(`https://graph.facebook.com/722084814632778?fields=access_token&access_token=${access_token}`, function (err, response, body) {
            let access_token = JSON.parse(body).access_token;
            let post_link = 'https://yuanchieh.info/issues/' + process.env.LatestIssue;
            let post_message = 'Newletter for this week!';
            console.log(access_token);

            let post_page_url = `https://graph.facebook.com/v2.8/722084814632778/feed?message=${post_message}&link=${post_link}&access_token=${access_token}`;

            //操作頁面權限的Token發文
            request.post(post_page_url, function (err, response, body) {
                console.log(body);
            })
        })
    });
}

weeklyFacebookPost();

module.exports = router;
