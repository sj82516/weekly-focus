### Weekly Focus
平常有訂閱Javascript Weekly/ Node Weekly等等電子週報的習慣，因為好奇所以自己設法打造一個  
UI與UX大量參考原網站，如有侵權煩請告知  
除了原本的功能外，自己而外加上了 取消訂閱(原網站我真的找不到取消訂閱的連結...)與後台  
[Demo影片](https://vimeo.com/205758478)
因為想要練習寫Messenger BOT，所以就順手上線了 [yuanchieh.info](http://yuanchieh.info/)
#### 架構
使用NodeJS搭配Express，頁面渲染引擎使用Jade 


#### 功能
1. 訂閱與取消訂閱，兩者都需要郵件驗證，其中取消訂閱還要通過reCAPTCHA測試
![Imgur](http://i.imgur.com/scYSzK6.jpg)
2. 基本的瀏覽Issue頁面與搜尋功能
![Imgur](http://i.imgur.com/sh90ueY.jpg)
3. 基本後站的設計，包含修改發送日期與新增article到當期的Issue中
![Imgur](http://i.imgur.com/AmylLNU.jpg)
4. HTML Email設計(持續優化中)
![Imgur](http://i.imgur.com/vqf9O0s.jpg)
5. 加入Messenger BOT
![Imgur](http://i.imgur.com/gJZNHoU.png)
6. 加入粉絲專頁自動發文

#### 實作紀錄
1. HTML Email
寫法與一般網站大有不同，主體都是用Table做layout，排版也是透過align來調整，沒有過多CSS可以用(看文件說只有到CSS2以下，支援也不完整..)  
因為寫起來很麻煩，所以建議直接改 [HTML Email boiperlate](https://github.com/seanpowell/Email-Boilerplate)比較快  
常用的CSS大概也就是 padding / margin (前兩者不能用table中，要放在td裡才有用) font-size / font-family / color / background / border  
還有原本xml tag支援的屬性，如cellspacing / cellpadding / align 這一類  
這幾個是我排版有用到的  
另外，開發過程可以直接先用HTML先確認layout正確，記得不能用太先進的CSS語法；接著可以用[Thunderbird](https://moztw.org/thunderbird/)這個Email Client
他的好處是可以直接用HTML語法輸入並渲染，直接就可以看到效果。  
2. nodemailer 與 cron
寄信服務是透過nodemailer實作，相當簡單，如果是使用Gmail要記得第一次帳號會需要認證，而且會有[大量寄送的問題](https://support.google.com/a/answer/166852?hl=zh-Hant)
所以我將郵件用50封為一個單位發送，避免被識別為垃圾郵件，用遞回方式持續發送  
至於定期週幾發送就是透過cron，支援crontab寫法相當方便，不過要特別留意`官方文件提到 必須是nodejs file持續執行時使用cron才有效，像是Server這樣長期保持執行才有用`，反之就用*unix系統原生的crontab即可
3. Mongo DB - Table join
本來以為NoSQL沒有JOIN的功能，想不到還是有的，[Population](http://mongoosejs.com/docs/populate.html)，不過目前強迫_id當作foreign key，自己設定的auto increment key沒辦法用..
只能繼續用兩個迴圈處理了
4. Mongo DB - Text Search
在Mongo DB 2.6之後就支援文字搜尋，Text Search支援欄位為String或是Array of String，MongoDB會將string拆解並以單字形式(tokenize adn stem)存放在RAM中方便搜尋  
宣告方式如果是用Mongoose可以在欄位直接宣告"text:true"，詳見[Mongoose pull request #2453](https://github.com/Automattic/mongoose/pull/2453)  
`Schema( { ...., content:{type: String,text: true} }`  
或是用[ensureIndex](https://code.tutsplus.com/tutorials/full-text-search-in-mongodb--cms-24835)
`db.collection.ensureIndex({ name: "text", description : "text", category : "text" });`
搜尋方式要用關鍵字`$text與$search`，如`ArticleModel.find({$text: {$search: searchInput}})`這般
此外MongoDB也支援權重分配，也可以依據權重排序，但是不支援原本的text sort
之後再來徹底研究一下
5. Mongoose - Lean
Mongoose find之後會回傳DAO，但如果想要純JS Object可以用`lean()`  
如 IssueModel.find({id: {$lte: parseInt(process.env.LatestIssue)}}).sort({id: -1}).lean()

#### Todo
1. 加入Blog形態的文章，目前所有(包含nodeweekly等)都只是外部連結文章，希望加入更完整CMS系統
2. admin驗證、與管理員修改記錄追蹤
