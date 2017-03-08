const express = require('express');
let router = express.Router();
const request = require('request');

const ArticleModel = require('../model/article.model').ArticleModel;
const IssueModel = require('../model/issue.model').IssueModel;

// 加入csrf
const csurf = require('csurf');
let csrfProtection = csurf({cookie: false});

/* GET home page. */
router.get('/', csrfProtection, function (req, res, next) {
    let errorMsg = req.query.error;
    let successMsg = req.query.success;
    let success = null;
    let error = handleErrorMsg(errorMsg);
    // 訊息顯示，有些從其他連結轉發而來
    if (errorMsg) {
        let error = handleErrorMsg(errorMsg);
    }
    if (successMsg) {
        switch (successMsg) {
            case 'subscribe':
                success = 'Subscribed successfully! Check your email for the latest issue!';
                break;
            case 'unsubscribe':
                success = 'Unsubscribed successfully! You can still browse our issues on web.';
                break;
        }
    }
    return res.render('index', {
        cronDay: process.env.Cronday,
        latestIssue: process.env.LatestIssue,
        csrfToken: req.csrfToken(),
        errorMsg: error,
        successMsg: success
    });

});

router.get('/issues', function (req, res, next) {
    let issueList = [];
    IssueModel.find({id: {$lte: parseInt(process.env.LatestIssue)}}).sort({id: -1}).lean().exec().then((issueListDB)=> {
        "use strict";
        issueList = issueListDB;
        return Promise.all(issueList.map(issue => {
            return ArticleModel.find({issueId: issue.id}).limit(3).sort({issueId: -1}).exec()
        }))
    }).then(articleList => {
        "use strict";
        // 此時的articleList是雙層迴圈，包含每期Issue各自文章的陣列
        articleList.forEach((articleListinIssue, i, arr) => {
            issueList[i].introList = [];
            issueList[i].date = handleDateFormat(issueList[i].date);
            articleListinIssue.map(article=> {
                issueList[i].introList = issueList[i].introList.concat(article.title);
            })
        });
        console.log(issueList[0]);
        res.render('issues', {
            issueList
        });
    }).catch(err => {
        console.log(err);
        "use strict";

    });
});

router.get('/issues/:id', csrfProtection, function (req, res, next) {
    // 如果超過範圍
    if (req.params.id > process.env.LatestIssue || req.params.id == 0) {
        return res.render('issue', {
            cronDay: process.env.Cronday,
            latestIssue: process.env.LatestIssue,
            issueId: 0,
            csrfToken: req.csrfToken(),
            articleList: []
        });
    }
    let date = new Date();
    IssueModel.findOne({id: req.params.id}, 'date -_id').exec().then( dateDB => {
        "use strict";
        date = handleDateFormat(dateDB.date);
        return ArticleModel.find({'issueId': req.params.id}).exec()
    }).then(articleList => {
        "use strict";
        res.render('issue', {
            cronDay: process.env.Cronday,
            latestIssue: process.env.LatestIssue,
            issueId: req.params.id,
            csrfToken: req.csrfToken(),
            date,
            articleList
        });
    });
});

router.get('/search', function (req, res, next) {
    let searchInput = req.query.q || '';
    if (searchInput == '') {
        return res.render('search', {
            webTitle: 'Weekly Focus',
            latestIssue: process.env.LatestIssue,
            emptySearch: true,
            searchInput: '',
            resultList: []
        });
    }

    ArticleModel.find({
        $text: {$search: searchInput},
        issueId: {$lte: parseInt(process.env.LatestIssue)}
    }).exec().then(articles => {
        "use strict";
        console.log(articles);
        res.render('search', {
            webTitle: 'Weekly Focus',
            latestIssue: process.env.LatestIssue,
            emptySearch: false,
            result: articles.length + " result of",
            searchInput: searchInput,
            resultList: articles || []
        });
    });
});

/* subscribe跳轉的頁面. */
router.get('/thankyou', function (req, res, next) {
    // 總共只有subscribe和unsubscribe在輸入信箱成功後，會導到這裡來
    let isSubscribe = req.query.success === 'subscribe';

    res.render('thankyou', {
        latestIssue: process.env.LatestIssue,
        isSubscribe,
        publicationList: [
            {
                name: 'Mobile Web Weekly',
                link: 'http://mobilewebweekly.co/',
                intro: 'A weekly round-up of the releases, articles, and links that affect Web developers working on the mobile-facing Web'
            },
            {
                name: 'Cloud Development Weekly',
                link: 'http://clouddevweekly.co/',
                intro: 'News, links and resources for developers working with cloud services, cloud APIs, and cloud-based tools'
            }
        ]
    });
});

// 使用者要求取消訂閱頁面
router.get('/unsubscribe', csrfProtection, function (req, res) {
    "use strict";
    let errorMsg = req.query.error;
    let error = handleErrorMsg(errorMsg);

    // 訊息顯示，有些從其他連結轉發而來
    res.render('unsubscribe', {
        cronDay: process.env.Cronday,
        latestIssue: process.env.LatestIssue,
        csrfToken: req.csrfToken(),
        errorMsg: error
    });
});

// 處理所有的Error Msg字串
// 如果沒有則回傳null
function handleErrorMsg(errorMsg) {
    "use strict";
    if (!errorMsg) {
        return null;
    }
    let error = null;
    switch (errorMsg) {
        case 'request':
            error = 'Email error! Please check your email and subscribe again!';
            break;
        case 'robot':
            error = 'Are you robot?';
            break;
        case 'server':
            error = 'Server error! We will fix the bugs ASAP.';
            break;
        case 'miss-param':
            error = 'You have to fill in email and click recaptcha to prove you are not robot.';
            break;
        case 'token':
            error = 'Authentication error! Please redirect to index page and subscribe again!';
            break;
        case 'email-not-exist':
            error = 'Email not exist.';
            break;
        case 'email-exist':
            error = 'You have already subscribed!';
            break;
        case 'email':
            error = 'Email error! Please check your email and subscribe again!';
            break;
    }
    return error;
}

// 處理日期格式，回傳字串
function handleDateFormat(date){
    "use strict";
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return monthNames[new Date(date).getMonth()] + ' ' +  new Date(date).getDate() + ', ' + new Date(date).getFullYear();
}

//加入github的webhook，自動pull
const child = spawn('git pull origin master', [], {
    detached: true,
    stdio: ['ignore']
});

module.exports = router;
